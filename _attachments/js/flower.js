(function() {
  window.Views = (typeof window.Views !== "undefined" && window.Views !== null) ? window.Views : {};
  window.Models = (typeof window.Models !== "undefined" && window.Models !== null) ? window.Models : {};
  Models.Node = Backbone.Model.extend({
    defaults: {
      position: {
        x: 0,
        y: 0
      },
      content: '',
      size: 12
    }
  });
  Views.Node = Backbone.View.extend({
    el: 'div'
  });
  Collections.Nodes = Backbone.Collection.extend({
    couch: {
      db: 'document_1',
      ddoc: 'document',
      view: 'nodes'
    }
  });
}).call(this);
