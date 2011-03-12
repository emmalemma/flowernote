window.Views ?= {}
window.Models ?= {}
window.Collections ?= {}

window.Physics =
	drag:(node)->
		coefficient = 0.1
		
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

Models.Node = Backbone.Model.extend
	defaults:
		position:
			x: 0
			y: 0
		content: ''
		size: 12
		
	velocity:
		x: 3
		y: 1
		
	initialize:->
		_.bindAll @, 'tick'
		@tick()
	
	forces: [Physics.drag]
	
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
		
		#console.log position.x,position.y, @velocity.x,@velocity.y, @acceleration.x,@acceleration.y 
		
		_.delay @tick, 10
		
Collections.Nodes = Backbone.Collection.extend
	model: Models.Node
	couch:
		ddoc: 'document'
		view: 'all'

	initialize:(options)->
		if options.db
			@couch.db = options.db
			
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
				@startDrag(e)
			else if distance < @radius + 10
				node = new Models.Node
					position:
						x: e.pageX
						y: e.pageY
					content: 'new node'
				Nodes.collection.add node
		
		#and it moves
		@model.bind 'change:position', @move
		
	render:->
		@content.css
			"font-size": "#{@model.get 'size'}pt"
		
		@content.text @model.get 'content'
		
		_.defer @resize
		
		@
		
	resize:->
		if @content.attr('offsetHeight') - @el.height() > 10
			@radius += 1
			@el.css
				width: "#{@radius * 2}px"
				height: "#{@radius * 2}px"
				"border-radius": "#{@radius * 2}px"
			_.defer @resize
		else if @content.attr('offsetHeight') - @el.height() < -10
			@radius -= 1
			@el.css
				width: "#{@radius * 2}px"
				height: "#{@radius * 2}px"
				"border-radius": "#{@radius * 2}px"
			_.defer @resize
			 
	edit:->
		@el.addClass 'editable'
		
		@content.attr('contentEditable', on)
		@content.focus()
		
		@content.keydown @resize
	unedit:->
		@content.attr('contentEditable', off)
		@el.removeClass 'editable'
		@content.unbind 'keydown'
		
	move:->
		@el.css
			left:	"#{@model.attributes.position.x-@radius-10}px"
			top:	"#{@model.attributes.position.y-@radius-10}px"
				
	startDrag:(e)->
		constant = 0.1
		
		dragTarget =
			x: @model.attributes.position.x
			y: @model.attributes.position.y
		$('.document').mousemove (e)=>
						dragTarget =
							x: e.pageX
							y: e.pageY
						console.log dragTarget.x, dragTarget.y, e
		
		drag =(node)=>
			accel=
				x: (node.attributes.position.x - dragTarget.x) * -constant
				y: (node.attributes.position.y - dragTarget.y) * -constant
			accel
			
		@model.forces.push drag
		
		$('.document').mouseup (e)=>
						$('.document').unbind 'mousemove'
						$('.document').unbind 'mouseup'
						@model.forces = _(@model.forces).without drag
						console.log forces: @model.forces

Views.Nodes = Backbone.View.extend
	initialize:(options)->
		_.bindAll @, 'addNodes', 'addNode'
		
		@collection.bind 'refresh', @addNodes
		@collection.bind 'add', @addNode
		
		@collection.fetch()
		
	addNodes:(col)->
		col.each @addNode
		
	addNode:(node)->
		node.view = new Views.Node model: node
		@el.append node.view.render().el
		
window.Nodes = new Views.Nodes 
	collection: new Collections.Nodes
		db: 'document_1'
	el: $('.document')