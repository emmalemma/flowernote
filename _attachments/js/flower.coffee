window.Views ?= {}
window.Models ?= {}
window.Collections ?= {}

window.Physics =
	drag:(node)->
		coefficient = 0.07
		
		accel =
			x: if node.velocity.x then -Math.cos(node.theta)*coefficient else 0
			y: if node.velocity.y then -Math.sin(node.theta)*coefficient else 0
		if (-accel.x > node.velocity.x)
			node.velocity.x = 0
			accel.x = 0
		if (-accel.y > node.velocity.y)
			node.velocity.y = 0
			accel.y = 0
		accel
		
	rest: 0.0001
Models.Link = Backbone.Model.extend
	defaults:
		kind: 'link'
		nodes: []
		length: 100
		content: ''
		
	initialize:->
		console.log @
		if @nodes[0] is Model.Node
			@nodes = @model.attributes.nodes
			@model.attributes.nodes = []
		
		#apply a spring force to the two nodes
		_([[@nodes[0],@nodes[1]],[@nodes[1],@nodes[0]]]).each (nodes)->
			[n1,n2] = nodes
			console.log "pushing #{n1.get 'content'} toward #{n2.get 'content'}"
			n1.forces.push (node)->
				equilibrium = @get 'length'
				coefficient = 0.0001
				dx = n2.attributes.position.x - n1.attributes.position.x
				dy = n2.attributes.position.y - n1.attributes.position.y
				distance = Math.sqrt(dx*dx + dy*dy)
				accel =
					x: dx * coefficient * (distance - equilibrium)
					y: dy * coefficient * (distance - equilibrium)
				
		
Models.Node = Backbone.Model.extend
	defaults:
		kind: 'node'
		position:
			x: 0
			y: 0
		content: ''
		size: 12
		
	initialize:->
		_.bindAll @, 'tick'
		
		@forces = [Physics.drag]
		
		@velocity = 
			x: 0
			y: 0
		
		@tick()
	
	tick:->
		#find the direction of travel
		@theta = Math.atan2(@velocity.y,@velocity.x)
		
		#apply the forces acting on us
		for force in @forces
			accel = force(@)
			@velocity.x += accel.x
			@velocity.y += accel.y
				
		if Math.abs(@velocity.x) < Physics.rest
			@velocity.x = 0
		if Math.abs(@velocity.y) < Physics.rest
			@velocity.y = 0
			
		position = @attributes.position
		position.x += @velocity.x
		position.y += @velocity.y
	
		@trigger 'change:position', @
		
		_.delay @tick, 10

Collections.Links = Backbone.Collection.extend
	model: Models.Link
	couch:
		ddoc: 'document'
		view: 'byKind'
		key: 'link'
		
	initialize:(models, options)->
		if options.db
			@couch.db = options.db

Collections.Nodes = Backbone.Collection.extend
	model: Models.Node
	couch:
		ddoc: 'document'
		view: 'byKind'
		key: 'node'

	initialize:(models, options)->
		console.log models, options
		if options.db
			@couch.db = options.db

Views.Link = Backbone.View.extend
	tagName: 'div'
	className: 'link'
		
	initialize:->
		_.bindAll @, 'render', 'draw'
		
		@el = $(@el)
		@content = $("<div class='content' />")
		@el.append @content
		
		_.each @model.get('nodes'), (node)=>
			node.bind 'change:position', @draw
		
		@draw()
		
	render:->
		@content.text @model.get 'content'
		@
		
	draw:->
		nodes = @model.get 'nodes'
		n1 = nodes[0]
		n2 = nodes[1]
		
		x1 = n1.attributes.position.x
		x2 = n2.attributes.position.x
		y1 = n1.attributes.position.y
		y2 = n2.attributes.position.y
		
		dx = x2-x1
		dy = y2-y1
		
		distance = Math.sqrt(dx*dx + dy*dy)
		@el.css
			width: 	"#{distance}px"
			left:	"#{x1+dx/2 - distance/2}px"
			top:	"#{y1+dy/2}px"
			"-webkit-transform": "rotate(#{Math.atan2(dy,dx)}rad)"

Views.Node = Backbone.View.extend
	tagName: 'div'
	className: 'node'	
	
	initialize:->
		_.bindAll @, 'render', 'resize', 'edit', 'unedit', 'move', 'startDrag'
		
		@el = $(@el)
		@content = $("<div class='content' />")
		@el.append @content
		
		#it has a size
		@radius = 10
		
		#and a position
		@move()
		
		
		
		#you can edit it
		@content.dblclick @edit
		@content.blur @unedit
		
		#when you edit it, it changes size
		@model.bind 'change:content', @render
		
		#you can drag it
		@el.mousedown (e)=>
			x = e.pageX-@el.position().left-@radius-10
			y = e.pageY-@el.position().top-@radius-10
			distance = Math.sqrt(x*x + y*y)
			if distance < @radius
				#let the user select text if they're editing
				return if @el.hasClass 'editable'
				@startDrag(e)
			else if distance < @radius + 10
				#stop editing
				if @el.hasClass 'editable'
					@unedit
				#create a child node
				node = new Models.Node
					position:
						x: e.pageX
						y: e.pageY
					content: 'new node'
				
				#add it to the document
				Nodes.collection.add node
				
				#link us
				link = new Models.Link
					nodes: [@model, node]
				#and add the link
				Nodes.collection.add link
				
				#and start dragging it
				node.view.startDrag.call(node, e, edit: true)
		
		#and it moves
		@model.bind 'change:position', @move
		
	render:->
		@content.css
			"font-size": "#{@model.get 'size'}pt"
		
		@content.text @model.get 'content'
		
		_.defer @resize
		
		@
		
	resize:->
		#console.log @content.attr('scrollWidth') - @el.width(), @content.attr('scrollHeight') - @el.height()
		@content.css 	
			"margin-top": "-#{@content.attr('scrollHeight')/2}px"
			
		if @content.attr('scrollHeight') > @el.height() or @content.attr('scrollWidth') > @el.width()
			@radius += 1
			@el.css
				width: "#{@radius * 2}px"
				height: "#{@radius * 2}px"
				"border-radius": "#{@radius * 2}px"
			_.defer @resize
		# else if @content.attr('offsetHeight') - @el.height() < -10 or @content.attr('scrollWidth') - @el.width() < -10
		# 		@radius -= 1
		# 		@el.css
		# 			width: "#{@radius * 2}px"
		# 			height: "#{@radius * 2}px"
		# 			"border-radius": "#{@radius * 2}px"
		# 		_.defer @resize
			 
	edit:->
		@el.addClass 'editable'
		
		@content.attr('contentEditable', on)
		@content.focus()
		
		@content.keydown (e)=>
			if (e.keyCode == 13)
				@unedit()
			_.defer @resize
		_.defer @resize
		
	unedit:->
		@content.attr('contentEditable', off)
		@el.removeClass 'editable'
		@content.unbind 'keydown'
		
	move:->
		@el.css
			left:	"#{@position().x}px"
			top:	"#{@position().y}px"
				
	startDrag:(e, options)->
		options ?= {}
		constant = 0.1
		
		dragTarget =
			x: @model.attributes.position.x
			y: @model.attributes.position.y
		$('.document').mousemove (e)=>
						dragTarget =
							x: e.pageX
							y: e.pageY
		
		drag =(node)->
			accel=
				x: (node.attributes.position.x - dragTarget.x) * -constant
				y: (node.attributes.position.y - dragTarget.y) * -constant
			accel
			
		@model.forces.push drag
		
		$('.document').mouseup (e)=>
						$('.document').unbind 'mousemove'
						$('.document').unbind 'mouseup'
						@model.forces = _(@model.forces).without drag
						#this is a new node, start editing once it's placed
						if options.edit
							@edit()

	
	#the actual screen coordinates used for drawing
	position:->
		x: @model.attributes.position.x-@radius-10
		y: @model.attributes.position.y-@radius-10

Views.Nodes = Backbone.View.extend
	initialize:(options)->
		_.bindAll @, 'addObjs', 'addObj'
		
		@collection.bind 'refresh', @addObjs
		@collection.bind 'add', @addObj
		
		@collection.fetch()
		
		@links = new Collections.Links null, db: @collection.couch.db
		
		@links.bind 'refresh', @addObjs
		@links.bind 'add', @addObj
		
		
	addObjs:(col)->
		col.each @addObj
		
	addObj:(obj)->
		switch obj.attributes.kind
			when 'node'
				obj.view = new Views.Node model: obj
			when 'link'
				obj.view = new Views.Link model: obj
		@el.append obj.view.render().el
		
window.Nodes = new Views.Nodes {
	collection: new Collections.Nodes null, {db: 'document_1'}
	el: $('.document')
}