window.Views ?= {}
window.Models ?= {}

Models.Node = Backbone.Model.extend
	defaults:
		position:
			x: 0
			y: 0
		content: ''
		size: 12
		
Views.Node = Backbone.View.extend
	el: 'div'

Collections.Nodes = Backbone.Collection.extend
	couch:
		db: 'document_1'
		ddoc: 'document'
		view: 'nodes'