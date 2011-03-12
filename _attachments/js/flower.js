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
      coefficient = 0.07;
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
  Models.Link = Backbone.Model.extend({
    defaults: {
      kind: 'link',
      nodes: [],
      length: 100,
      content: ''
    },
    initialize: function() {
      console.log(this);
      if (this.nodes[0] === Model.Node) {
        this.nodes = this.model.attributes.nodes;
        this.model.attributes.nodes = [];
      }
      return _([[this.nodes[0], this.nodes[1]], [this.nodes[1], this.nodes[0]]]).each(function(nodes) {
        var _ref, n1, n2;
        _ref = nodes;
        n1 = _ref[0];
        n2 = _ref[1];
        console.log("pushing " + (n1.get('content')) + " toward " + (n2.get('content')));
        return n1.forces.push(function(node) {
          var accel, coefficient, distance, dx, dy, equilibrium;
          equilibrium = this.get('length');
          coefficient = 0.0001;
          dx = n2.attributes.position.x - n1.attributes.position.x;
          dy = n2.attributes.position.y - n1.attributes.position.y;
          distance = Math.sqrt(dx * dx + dy * dy);
          return (accel = {
            x: dx * coefficient * (distance - equilibrium),
            y: dy * coefficient * (distance - equilibrium)
          });
        });
      });
    }
  });
  Models.Node = Backbone.Model.extend({
    defaults: {
      kind: 'node',
      position: {
        x: 0,
        y: 0
      },
      content: '',
      size: 12
    },
    initialize: function() {
      _.bindAll(this, 'tick');
      this.forces = [Physics.drag];
      this.velocity = {
        x: 0,
        y: 0
      };
      return this.tick();
    },
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
  Collections.Links = Backbone.Collection.extend({
    model: Models.Link,
    couch: {
      ddoc: 'document',
      view: 'byKind',
      key: 'link'
    },
    initialize: function(models, options) {
      return options.db ? (this.couch.db = options.db) : null;
    }
  });
  Collections.Nodes = Backbone.Collection.extend({
    model: Models.Node,
    couch: {
      ddoc: 'document',
      view: 'byKind',
      key: 'node'
    },
    initialize: function(models, options) {
      console.log(models, options);
      return options.db ? (this.couch.db = options.db) : null;
    }
  });
  Views.Link = Backbone.View.extend({
    tagName: 'div',
    className: 'link',
    initialize: function() {
      _.bindAll(this, 'render', 'draw');
      this.el = $(this.el);
      this.content = $("<div class='content' />");
      this.el.append(this.content);
      _.each(this.model.get('nodes'), __bind(function(node) {
        return node.bind('change:position', this.draw);
      }, this));
      return this.draw();
    },
    render: function() {
      this.content.text(this.model.get('content'));
      return this;
    },
    draw: function() {
      var distance, dx, dy, n1, n2, nodes, x1, x2, y1, y2;
      nodes = this.model.get('nodes');
      n1 = nodes[0];
      n2 = nodes[1];
      x1 = n1.attributes.position.x;
      x2 = n2.attributes.position.x;
      y1 = n1.attributes.position.y;
      y2 = n2.attributes.position.y;
      dx = x2 - x1;
      dy = y2 - y1;
      distance = Math.sqrt(dx * dx + dy * dy);
      return this.el.css({
        width: ("" + (distance) + "px"),
        left: ("" + (x1 + dx / 2 - distance / 2) + "px"),
        top: ("" + (y1 + dy / 2) + "px"),
        "-webkit-transform": ("rotate(" + (Math.atan2(dy, dx)) + "rad)")
      });
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
        var distance, link, node, x, y;
        x = e.pageX - this.el.position().left - this.radius - 10;
        y = e.pageY - this.el.position().top - this.radius - 10;
        distance = Math.sqrt(x * x + y * y);
        if (distance < this.radius) {
          if (this.el.hasClass('editable')) {
            return null;
          }
          return this.startDrag(e);
        } else if (distance < this.radius + 10) {
          if (this.el.hasClass('editable')) {
            this.unedit;
          }
          node = new Models.Node({
            position: {
              x: e.pageX,
              y: e.pageY
            },
            content: 'new node'
          });
          Nodes.collection.add(node);
          link = new Models.Link({
            nodes: [this.model, node]
          });
          Nodes.collection.add(link);
          return node.view.startDrag.call(node, e, {
            edit: true
          });
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
      this.content.css({
        "margin-top": ("-" + (this.content.attr('scrollHeight') / 2) + "px")
      });
      if (this.content.attr('scrollHeight') > this.el.height() || this.content.attr('scrollWidth') > this.el.width()) {
        this.radius += 1;
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
      this.content.keydown(__bind(function(e) {
        if (e.keyCode === 13) {
          this.unedit();
        }
        return _.defer(this.resize);
      }, this));
      return _.defer(this.resize);
    },
    unedit: function() {
      this.content.attr('contentEditable', false);
      this.el.removeClass('editable');
      return this.content.unbind('keydown');
    },
    move: function() {
      return this.el.css({
        left: ("" + (this.position().x) + "px"),
        top: ("" + (this.position().y) + "px")
      });
    },
    startDrag: function(e, options) {
      var constant, drag, dragTarget;
      options = (typeof options !== "undefined" && options !== null) ? options : {};
      constant = 0.1;
      dragTarget = {
        x: this.model.attributes.position.x,
        y: this.model.attributes.position.y
      };
      $('.document').mousemove(__bind(function(e) {
        return (dragTarget = {
          x: e.pageX,
          y: e.pageY
        });
      }, this));
      drag = function(node) {
        var accel;
        accel = {
          x: (node.attributes.position.x - dragTarget.x) * -constant,
          y: (node.attributes.position.y - dragTarget.y) * -constant
        };
        return accel;
      };
      this.model.forces.push(drag);
      return $('.document').mouseup(__bind(function(e) {
        $('.document').unbind('mousemove');
        $('.document').unbind('mouseup');
        this.model.forces = _(this.model.forces).without(drag);
        return options.edit ? this.edit() : null;
      }, this));
    },
    position: function() {
      return {
        x: this.model.attributes.position.x - this.radius - 10,
        y: this.model.attributes.position.y - this.radius - 10
      };
    }
  });
  Views.Nodes = Backbone.View.extend({
    initialize: function(options) {
      _.bindAll(this, 'addObjs', 'addObj');
      this.collection.bind('refresh', this.addObjs);
      this.collection.bind('add', this.addObj);
      this.collection.fetch();
      this.links = new Collections.Links(null, {
        db: this.collection.couch.db
      });
      this.links.bind('refresh', this.addObjs);
      return this.links.bind('add', this.addObj);
    },
    addObjs: function(col) {
      return col.each(this.addObj);
    },
    addObj: function(obj) {
      switch (obj.attributes.kind) {
        case 'node':
          obj.view = new Views.Node({
            model: obj
          });
          break;
        case 'link':
          obj.view = new Views.Link({
            model: obj
          });
          break;
      }
      return this.el.append(obj.view.render().el);
    }
  });
  window.Nodes = new Views.Nodes({
    collection: new Collections.Nodes(null, {
      db: 'document_1'
    }),
    el: $('.document')
  });
}).call(this);
