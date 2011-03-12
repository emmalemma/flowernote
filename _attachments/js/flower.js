(function() {
  var __bind = function(func, context) {
    return function(){ return func.apply(context, arguments); };
  };
  window.Views = (typeof window.Views !== "undefined" && window.Views !== null) ? window.Views : {};
  window.Models = (typeof window.Models !== "undefined" && window.Models !== null) ? window.Models : {};
  window.Collections = (typeof window.Collections !== "undefined" && window.Collections !== null) ? window.Collections : {};
  window.Physics = {
    drag: function(node) {
      var accel, coefficient;
      coefficient = 0.1;
      accel = {
        x: node.velocity.x ? -Math.cos(node.theta) * coefficient : 0,
        y: node.velocity.y ? -Math.sin(node.theta) * coefficient : 0
      };
      if (-accel.x > node.velocity.x) {
        node.velocity.x = 0;
        accel.x = 0;
      }
      if (-accel.y > node.velocity.y) {
        node.velocity.y = 0;
        accel.y = 0;
      }
      return accel;
    },
    rest: 0.0001
  };
  Models.Node = Backbone.Model.extend({
    defaults: {
      position: {
        x: 0,
        y: 0
      },
      content: '',
      size: 12
    },
    velocity: {
      x: 3,
      y: 1
    },
    initialize: function() {
      _.bindAll(this, 'tick');
      return this.tick();
    },
    forces: [Physics.drag],
    tick: function() {
      var _i, _len, _ref, accel, force, position;
      this.theta = Math.atan2(this.velocity.y, this.velocity.x);
      _ref = this.forces;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        force = _ref[_i];
        accel = force(this);
        this.velocity.x += accel.x;
        this.velocity.y += accel.y;
      }
      if (Math.abs(this.velocity.x) < Physics.rest) {
        this.velocity.x = 0;
      }
      if (Math.abs(this.velocity.y) < Physics.rest) {
        this.velocity.y = 0;
      }
      position = this.attributes.position;
      position.x += this.velocity.x;
      position.y += this.velocity.y;
      this.trigger('change:position', this);
      return _.delay(this.tick, 10);
    }
  });
  Collections.Nodes = Backbone.Collection.extend({
    model: Models.Node,
    couch: {
      ddoc: 'document',
      view: 'all'
    },
    initialize: function(options) {
      return options.db ? (this.couch.db = options.db) : null;
    }
  });
  Views.Node = Backbone.View.extend({
    tagName: 'div',
    className: 'node',
    initialize: function() {
      _.bindAll(this, 'render', 'resize', 'edit', 'unedit', 'move', 'startDrag');
      this.el = $(this.el);
      this.content = $("<div class='content' />");
      this.el.append(this.content);
      this.radius = 10;
      this.move();
      this.content.dblclick(this.edit);
      this.content.blur(this.unedit);
      this.model.bind('change:content', this.render);
      this.el.mousedown(__bind(function(e) {
        var distance, node, x, y;
        x = e.pageX - this.el.position().left - this.radius - 10;
        y = e.pageY - this.el.position().top - this.radius - 10;
        distance = Math.sqrt(x * x + y * y);
        if (distance < this.radius) {
          return this.startDrag(e);
        } else if (distance < this.radius + 10) {
          node = new Models.Node({
            position: {
              x: e.pageX,
              y: e.pageY
            },
            content: 'new node'
          });
          return Nodes.collection.add(node);
        }
      }, this));
      return this.model.bind('change:position', this.move);
    },
    render: function() {
      this.content.css({
        "font-size": ("" + (this.model.get('size')) + "pt")
      });
      this.content.text(this.model.get('content'));
      _.defer(this.resize);
      return this;
    },
    resize: function() {
      if (this.content.attr('offsetHeight') - this.el.height() > 10) {
        this.radius += 1;
        this.el.css({
          width: ("" + (this.radius * 2) + "px"),
          height: ("" + (this.radius * 2) + "px"),
          "border-radius": ("" + (this.radius * 2) + "px")
        });
        return _.defer(this.resize);
      } else if (this.content.attr('offsetHeight') - this.el.height() < -10) {
        this.radius -= 1;
        this.el.css({
          width: ("" + (this.radius * 2) + "px"),
          height: ("" + (this.radius * 2) + "px"),
          "border-radius": ("" + (this.radius * 2) + "px")
        });
        return _.defer(this.resize);
      }
    },
    edit: function() {
      this.el.addClass('editable');
      this.content.attr('contentEditable', true);
      this.content.focus();
      return this.content.keydown(this.resize);
    },
    unedit: function() {
      this.content.attr('contentEditable', false);
      this.el.removeClass('editable');
      return this.content.unbind('keydown');
    },
    move: function() {
      return this.el.css({
        left: ("" + (this.model.attributes.position.x - this.radius - 10) + "px"),
        top: ("" + (this.model.attributes.position.y - this.radius - 10) + "px")
      });
    },
    startDrag: function(e) {
      var constant, drag, dragTarget;
      constant = 0.1;
      dragTarget = {
        x: this.model.attributes.position.x,
        y: this.model.attributes.position.y
      };
      $('.document').mousemove(__bind(function(e) {
        dragTarget = {
          x: e.pageX,
          y: e.pageY
        };
        return console.log(dragTarget.x, dragTarget.y, e);
      }, this));
      drag = __bind(function(node) {
        var accel;
        accel = {
          x: (node.attributes.position.x - dragTarget.x) * -constant,
          y: (node.attributes.position.y - dragTarget.y) * -constant
        };
        return accel;
      }, this);
      this.model.forces.push(drag);
      return $('.document').mouseup(__bind(function(e) {
        $('.document').unbind('mousemove');
        $('.document').unbind('mouseup');
        this.model.forces = _(this.model.forces).without(drag);
        return console.log({
          forces: this.model.forces
        });
      }, this));
    }
  });
  Views.Nodes = Backbone.View.extend({
    initialize: function(options) {
      _.bindAll(this, 'addNodes', 'addNode');
      this.collection.bind('refresh', this.addNodes);
      this.collection.bind('add', this.addNode);
      return this.collection.fetch();
    },
    addNodes: function(col) {
      return col.each(this.addNode);
    },
    addNode: function(node) {
      node.view = new Views.Node({
        model: node
      });
      return this.el.append(node.view.render().el);
    }
  });
  window.Nodes = new Views.Nodes({
    collection: new Collections.Nodes({
      db: 'document_1'
    }),
    el: $('.document')
  });
}).call(this);
