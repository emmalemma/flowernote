window.Views ?= {}
window.Models ?= {}
window.Collections ?= {}

window.Physics =
	friction:(node)->
		coefficient = -0.2
		
		accel =
			x: node.velocity.x * coefficient
			y: node.velocity.y * coefficient
		
	repel:(node)->
		#the repulsive force of nodes
		charge = 24
		range = 200
		accel =
			x: 0
			y: 0
			
		_.each Nodes.collection.without(node), (other)=>
			return unless other.attributes.position?
			return if other.view.dragging
			dx = node.attributes.position.x - other.attributes.position.x
			dy = node.attributes.position.y - other.attributes.position.y
			distance = Math.sqrt(dx*dx + dy*dy)
			theta = Math.atan2(dy,dx)
			
			return unless distance < range
			
			ax = Math.cos(theta) * (1/distance) * charge
			ay = Math.sin(theta) * (1/distance) * charge
			accel.x += ax
			accel.y += ay
		accel
		
	rest: 0.1
	
Models.Link = Backbone.Model.extend
	defaults:
		kind: 'link'
		nodes: []
		length: 50
		content: ''
		
	initialize:->
		_.bindAll @, 'remove', 'respring'
		@nodes = []
		@forces = []
		#if we have node ids, we need to get models from them
		if typeof @attributes.nodes[0] == 'string' #pull a node from its id
			_.each @attributes.nodes, (id)=>
				node = Nodes.collection.get id #try to get it if it exists
				@nodes.push node if node
		else
			#if we've got node models, we need to turn them into ids
			@nodes = @attributes.nodes
			
		if (@nodes.length != 2)
			return @remove()
		
		_([[@nodes[0],@nodes[1]],[@nodes[1],@nodes[0]]]).each (nodes)=>
			[n1,n2] = nodes
			force =(node)=>
				equilibrium = @attributes.length
				return {x: 0, y: 0} if n2.view.dragging or n1.view.dragging
				coefficient = -0.05
				dx = n1.attributes.position.x - n2.attributes.position.x
				dy = n1.attributes.position.y - n2.attributes.position.y
				distance = Math.sqrt(dx*dx + dy*dy)
				theta = Math.atan2(dy,dx)
				
				accel =
					x: Math.cos(theta) * coefficient * (distance - equilibrium)
					y: Math.sin(theta) * coefficient * (distance - equilibrium)
			n1.forces.push force
			@forces.push force
			
		@bind 'change:length', ()=>@save null
			
	remove:->
		#remove my force from nodes
		for node in @nodes
			for force in @forces
				node.forces = _(node.forces).without(force)
		#then remove me
		@collection.remove @
		
	respring:->
		[n1,n2] = @nodes
		dx = n2.attributes.position.x - n1.attributes.position.x
		dy = n2.attributes.position.y - n1.attributes.position.y
		distance = Math.sqrt(dx*dx + dy*dy)
		@set length: distance

	
Models.Node = Backbone.Model.extend
	defaults:
		kind: 'node'
		position:
			x: 0
			y: 0
		content: ''
		size: 12
		pinned: false
		
	initialize:->
		_.bindAll @, 'tick', 'remove', 'eachLink'
		
		@forces = [Physics.friction, Physics.repel]
		
		@velocity = 
			x: 0
			y: 0
		
		@bind 'change:content', ()=>
									@save null,
										success: (m,r)=>console.log m,r
										error: (m,r)=>console.log m,r
		
		@bind 'change:pinned', ()=>
									@save null,
										success: (m,r)=>console.log m,r
										error: (m,r)=>console.log m,r
		
		_.defer @tick
	
	tick:->
		if @get 'pinned'
			return
		#find the direction of travel
		@theta = Math.atan2(@velocity.y,@velocity.x)
		
		#apply the forces acting on us
		for force in @forces
			accel = force(@)
			@velocity.x += accel.x
			@velocity.y += accel.y
			
		#rest if we're resting
		if Math.abs(@velocity.x) < Physics.rest and Math.abs(@velocity.y) < Physics.rest
			@velocity = {x: 0, y: 0}
		else #otherwise move
			position = @attributes.position
			position.x += @velocity.x
			position.y += @velocity.y
		
		
		
			@trigger 'change:position', @
		
		_.delay @tick, 10
		
	remove:->
		#stop heartbeat
		@tick =-> null
		#remove any links on me
		@eachLink (link)->link.remove()
		#then remove me
		@collection.remove @
		
	eachLink:(f)->
		@collection.links.each (link)=>
			if link.attributes.nodes
				if @id in link.attributes.nodes
					_.defer f, link


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
		changes: on

	initialize:(models, options)->
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
		
		_.each @model.nodes, (node)=>
			node.bind 'change:position', @draw
		
		@draw()
		
	render:->
		@content.text @model.get 'content'
		@
		
	draw:->
		return unless @model.nodes.length == 2
		n1 = @model.nodes[0]
		n2 = @model.nodes[1]
		
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
		_.bindAll @, 'render', 'resize', 'edit', 'unedit', 'move', 'startDrag', 'savePosition', 'pin', 'endDrag'
		
		@el = $(@el)
		@content = $("<div class='content' />")
		@el.append @content
		
		#it has a size
		@radius = 10
		
		#and a position
		@move()
		@lastPos = _.clone @model.get('position')
		
		#you can edit it
		@content.dblclick @edit
		@content.blur @unedit
		
		if @model.editOnWake
			@edit()
		
		#when you edit it, it changes size
		@model.bind 'change:content', @render
		
		#when it moves, it saves itself... eventually
		
		@model.bind 'change:position', _.throttle(@savePosition, 10000)
		
		#you can drag it
		@dragging = no
		@el.click @startDrag
		
		countdown = null
		
		@el.mousedown (e)=>
			@spawning = true
			countdown = setTimeout (()=>
										@edit()
										@spawning = false
			), 500
			
		@el.mouseleave (e)=>
			if @spawning
				clearMousedown(e)
				@spawn
					position:
						x: e.pageX
						y: e.pageY
					content: 'new node'
		
		clearMousedown =(e)=>
			@spawning = false
			if countdown
				clearTimeout(countdown)
		

		@el.mouseup clearMousedown
		$('.document').mouseup clearMousedown
			
		#and it moves
		@model.bind 'change:position', @move
	
		if @model.get 'pinned'
			@el.addClass 'pinned'
	
	savePosition:(model)->
		pos = model.get 'position'
		#only save on significant moves
		if Math.abs(@lastPos.x-pos.x) > 10 or Math.abs(@lastPos.y-pos.y) > 10
			model.save null
			@lastPos = _.clone pos
	
	spawn:(attrs)->	
		#create a new node
		node = new Models.Node attrs
		#add it to the document
		Nodes.collection.add node
		#link us
		link = new Models.Link
			nodes: [@model, node]
		#and add the link
		Nodes.collection.links.add link
		
		#save the node to the server
		node.save null,
			success: (m,r)=>
				#and then save the link
				link.save {nodes: [@model.id, node.id]},
					success: (m,r)->console.log m,r
					error: (m,r)->console.log m,r
			error: (m,r)->console.log m,r
		
		#and start dragging it
		node.view.startDrag.call(node, null, edit: true)
		node.view.el.mouseup node.view.endDrag
		
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
		else if @content.attr('scrollHeight') < @el.height() and @content.attr('scrollWidth') < @el.width()
				@radius -= 1
				@el.css
					width: "#{@radius * 2}px"
					height: "#{@radius * 2}px"
					"border-radius": "#{@radius * 2}px"
				_.defer @resize
			 
	edit:->
		@el.append $("<div class='menu'><div class='remove'>X</div><div class='pin'>*</div></div>")
		@$('.menu .remove').mouseup @model.remove
		@$('.menu .pin').mouseup @pin
		@el.addClass 'editable'
		
		@content.attr('contentEditable', on)
		@content.focus()
		
		@content.keydown (e)=>
			if (e.keyCode == 13)
				@unedit()
			_.defer @resize
		_.defer @resize
		
	unedit:->
		#set the content
		@model.set content: @content.text()
		
		@content.attr('contentEditable', off)
		@el.removeClass 'editable'
		@content.unbind 'keydown'
		
		_.delay (()=>@$(".menu").remove()), 100
		
	pin:->
		@unedit()
		@model.set pinned: !@model.attributes.pinned
		if @model.attributes.pinned
			@el.addClass 'pinned'
		else
			@el.removeClass 'pinned'
			_.defer @model.tick
			
		
	move:->
		@el.css
			left:	"#{@position().x}px"
			top:	"#{@position().y}px"
				
	startDrag:(e, options)->
		options ?= {}
		
		return if @el.hasClass 'editable'
		
		@el.addClass 'dragging'
		
		constant = 0.01
		@dragging = true
		dragTarget =
			x: @model.attributes.position.x
			y: @model.attributes.position.y
		$('.document').mousemove (e)=>
						dragTarget =
							x: e.pageX
							y: e.pageY
		@drag =(node)->
			accel=
				x: (node.attributes.position.x - dragTarget.x) * -constant
				y: (node.attributes.position.y - dragTarget.y) * -constant
			accel
		@model.forces.push @drag
		
		@el.click @endDrag
		
	endDrag:(e)->
		return unless @dragging
		@dragging = false
		
		@el.removeClass 'dragging'
		
		$('.document').unbind 'mousemove'
		$('.document').unbind 'click'
		@model.forces = _(@model.forces).without @drag
		#this is a new node, start editing once it's placed
		if options.edit
			@edit()
			@selectContent()
		@model.eachLink (link)=>link.respring()
		
		@el.unbind 'click'
		@el.click @startDrag
					
	selectContent:->
		range = document.createRange()
		range.selectNode(@content[0])
		window.getSelection().addRange(range)
	
	#the actual screen coordinates used for drawing
	position:->
		x: @model.attributes.position.x-@radius-10
		y: @model.attributes.position.y-@radius-10

Views.Nodes = Backbone.View.extend
	initialize:(options)->
		_.bindAll @, 'addObjs', 'addObj', 'removeObj'
		
		@collection.bind 'refresh', @addObjs
		@collection.bind 'add', @addObj
		
		@collection.bind 'remove', @removeObj
		
		@collection.fetch()
		
		@links = new Collections.Links null, db: @collection.couch.db
		
		@collection.bind 'refresh', ()=> #when we have nodes, get links
			@links.bind 'refresh', @addObjs
			@links.bind 'add', @addObj
			@links.bind 'remove', @removeObj
		
			@links.fetch()
		@collection.links = @links
		
		@el.dblclick (e)=>
						return unless e.target == e.currentTarget
						node = new Models.Node
											position:
												x: e.pageX
												y: e.pageY
											content: 'new node'
						node.editOnWake = true
						@collection.add node
						node.save null
		
	removeObj:(model,col)->
		#delete it from the DOM
		model.view.el.remove()
		#then destroy it on the server
		model.couch = col.couch
		model.destroy()
		
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