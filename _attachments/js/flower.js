(function() {
  var __bind = function(func, context) {
    return function(){ return func.apply(context, arguments); };
  };
  window.Views = (typeof window.Views !== "undefined" && window.Views !== null) ? window.Views : {};
  window.Models = (typeof window.Models !== "undefined" && window.Models !== null) ? window.Models : {};
  window.Collections = (typeof window.Collections !== "undefined" && window.Collections !== null) ? window.Collections : {};
  window.Physics = {
    friction: function(node) {
      var accel, coefficient;
      coefficient = -0.2;
      return (accel = {
        x: node.velocity.x * coefficient,
        y: node.velocity.y * coefficient
      });
    },
    repel: function(node) {
      var accel, charge, range;
      charge = 24;
      range = 200;
      accel = {
        x: 0,
        y: 0
      };
      _.each(Nodes.collection.without(node), __bind(function(other) {
        var _ref, ax, ay, distance, dx, dy, theta;
        if (!(typeof (_ref = other.attributes.position) !== "undefined" && _ref !== null)) {
          return null;
        }
        if (other.view.dragging) {
          return null;
        }
        dx = node.attributes.position.x - other.attributes.position.x;
        dy = node.attributes.position.y - other.attributes.position.y;
        distance = Math.sqrt(dx * dx + dy * dy);
        theta = Math.atan2(dy, dx);
        if (!(distance < range)) {
          return null;
        }
        ax = Math.cos(theta) * (1 / distance) * charge;
        ay = Math.sin(theta) * (1 / distance) * charge;
        accel.x += ax;
        return accel.y += ay;
      }, this));
      return accel;
    },
    rest: 0.1
  };
  Models.Link = Backbone.Model.extend({
    defaults: {
      kind: 'link',
      nodes: [],
      length: 50,
      content: ''
    },
    initialize: function() {
      _.bindAll(this, 'remove', 'respring');
      this.nodes = [];
      this.forces = [];
      if (typeof this.attributes.nodes[0] === 'string') {
        _.each(this.attributes.nodes, __bind(function(id) {
          var node;
          node = Nodes.collection.get(id);
          if (node) {
            return this.nodes.push(node);
          }
        }, this));
      } else {
        this.nodes = this.attributes.nodes;
      }
      if (this.nodes.length !== 2) {
        return this.remove();
      }
      _([[this.nodes[0], this.nodes[1]], [this.nodes[1], this.nodes[0]]]).each(__bind(function(nodes) {
        var _ref, force, n1, n2;
        _ref = nodes;
        n1 = _ref[0];
        n2 = _ref[1];
        force = __bind(function(node) {
          var accel, coefficient, distance, dx, dy, equilibrium, theta;
          equilibrium = this.attributes.length;
          if (n2.view.dragging || n1.view.dragging) {
            return {
              x: 0,
              y: 0
            };
          }
          coefficient = -0.05;
          dx = n1.attributes.position.x - n2.attributes.position.x;
          dy = n1.attributes.position.y - n2.attributes.position.y;
          distance = Math.sqrt(dx * dx + dy * dy);
          theta = Math.atan2(dy, dx);
          return (accel = {
            x: Math.cos(theta) * coefficient * (distance - equilibrium),
            y: Math.sin(theta) * coefficient * (distance - equilibrium)
          });
        }, this);
        n1.forces.push(force);
        return this.forces.push(force);
      }, this));
      return this.bind('change:length', __bind(function() {
        return this.save(null);
      }, this));
    },
    remove: function() {
      var _i, _j, _len, _len2, _ref, _ref2, force, node;
      _ref = this.nodes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        _ref2 = this.forces;
        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
          force = _ref2[_j];
          node.forces = _(node.forces).without(force);
        }
      }
      return this.collection.remove(this);
    },
    respring: function() {
      var _ref, distance, dx, dy, n1, n2;
      _ref = this.nodes;
      n1 = _ref[0];
      n2 = _ref[1];
      dx = n2.attributes.position.x - n1.attributes.position.x;
      dy = n2.attributes.position.y - n1.attributes.position.y;
      distance = Math.sqrt(dx * dx + dy * dy);
      return this.set({
        length: distance
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
      size: 12,
      pinned: false
    },
    initialize: function() {
      _.bindAll(this, 'tick', 'remove', 'eachLink');
      this.forces = [Physics.friction, Physics.repel];
      this.velocity = {
        x: 0,
        y: 0
      };
      this.bind('change:content', __bind(function() {
        return this.save(null, {
          success: __bind(function(m, r) {
            return console.log(m, r);
          }, this),
          error: __bind(function(m, r) {
            return console.log(m, r);
          }, this)
        });
      }, this));
      this.bind('change:pinned', __bind(function() {
        return this.save(null, {
          success: __bind(function(m, r) {
            return console.log(m, r);
          }, this),
          error: __bind(function(m, r) {
            return console.log(m, r);
          }, this)
        });
      }, this));
      return _.defer(this.tick);
    },
    tick: function() {
      var _i, _len, _ref, accel, force, position;
      if (this.get('pinned')) {
        return null;
      }
      this.theta = Math.atan2(this.velocity.y, this.velocity.x);
      _ref = this.forces;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        force = _ref[_i];
        accel = force(this);
        this.velocity.x += accel.x;
        this.velocity.y += accel.y;
      }
      if (Math.abs(this.velocity.x) < Physics.rest && Math.abs(this.velocity.y) < Physics.rest) {
        this.velocity = {
          x: 0,
          y: 0
        };
      } else {
        position = this.attributes.position;
        position.x += this.velocity.x;
        position.y += this.velocity.y;
        this.trigger('change:position', this);
      }
      return _.delay(this.tick, 10);
    },
    remove: function() {
      this.tick = function() {
        return null;
      };
      this.eachLink(function(link) {
        return link.remove();
      });
      return this.collection.remove(this);
    },
    eachLink: function(f) {
      return this.collection.links.each(__bind(function(link) {
        var _i, _len, _ref, _ref2;
        return link.attributes.nodes ? ((function(){ (_ref = this.id); for (var _i=0, _len=(_ref2 = link.attributes.nodes).length; _i<_len; _i++) { if (_ref2[_i] === _ref) return true; } return false; }).call(this) ? _.defer(f, link) : null) : null;
      }, this));
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
      key: 'node',
      changes: true
    },
    initialize: function(models, options) {
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
      _.each(this.model.nodes, __bind(function(node) {
        return node.bind('change:position', this.draw);
      }, this));
      return this.draw();
    },
    render: function() {
      this.content.text(this.model.get('content'));
      return this;
    },
    draw: function() {
      var distance, dx, dy, n1, n2, x1, x2, y1, y2;
      if (this.model.nodes.length !== 2) {
        return null;
      }
      n1 = this.model.nodes[0];
      n2 = this.model.nodes[1];
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
      var clearMousedown, countdown;
      _.bindAll(this, 'render', 'resize', 'edit', 'unedit', 'move', 'startDrag', 'savePosition', 'pin', 'endDrag');
      this.el = $(this.el);
      this.content = $("<div class='content' />");
      this.el.append(this.content);
      this.radius = 10;
      this.move();
      this.lastPos = _.clone(this.model.get('position'));
      this.content.dblclick(this.edit);
      this.content.blur(this.unedit);
      if (this.model.editOnWake) {
        this.edit();
      }
      this.model.bind('change:content', this.render);
      this.model.bind('change:position', _.throttle(this.savePosition, 10000));
      this.dragging = false;
      this.el.click(this.startDrag);
      countdown = null;
      this.el.mousedown(__bind(function(e) {
        this.spawning = true;
        return (countdown = setTimeout(__bind(function() {
          this.edit();
          return (this.spawning = false);
        }, this), 500));
      }, this));
      this.el.mouseleave(__bind(function(e) {
        if (this.spawning) {
          clearMousedown(e);
          return this.spawn({
            position: {
              x: e.pageX,
              y: e.pageY
            },
            content: 'new node'
          });
        }
      }, this));
      clearMousedown = __bind(function(e) {
        this.spawning = false;
        return countdown ? clearTimeout(countdown) : null;
      }, this);
      this.el.mouseup(clearMousedown);
      $('.document').mouseup(clearMousedown);
      this.model.bind('change:position', this.move);
      return this.model.get('pinned') ? this.el.addClass('pinned') : null;
    },
    savePosition: function(model) {
      var pos;
      pos = model.get('position');
      if (Math.abs(this.lastPos.x - pos.x) > 10 || Math.abs(this.lastPos.y - pos.y) > 10) {
        model.save(null);
        return (this.lastPos = _.clone(pos));
      }
    },
    spawn: function(attrs) {
      var link, node;
      node = new Models.Node(attrs);
      Nodes.collection.add(node);
      link = new Models.Link({
        nodes: [this.model, node]
      });
      Nodes.collection.links.add(link);
      node.save(null, {
        success: __bind(function(m, r) {
          return link.save({
            nodes: [this.model.id, node.id]
          }, {
            success: function(m, r) {
              return console.log(m, r);
            },
            error: function(m, r) {
              return console.log(m, r);
            }
          });
        }, this),
        error: function(m, r) {
          return console.log(m, r);
        }
      });
      node.view.startDrag.call(node, null, {
        edit: true
      });
      return node.view.el.mouseup(node.view.endDrag);
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
      } else if (this.content.attr('scrollHeight') < this.el.height() && this.content.attr('scrollWidth') < this.el.width()) {
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
      this.el.append($("<div class='menu'><div class='remove'>X</div><div class='pin'>*</div></div>"));
      this.$('.menu .remove').mouseup(this.model.remove);
      this.$('.menu .pin').mouseup(this.pin);
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
      this.model.set({
        content: this.content.text()
      });
      this.content.attr('contentEditable', false);
      this.el.removeClass('editable');
      this.content.unbind('keydown');
      return _.delay(__bind(function() {
        return this.$(".menu").remove();
      }, this), 100);
    },
    pin: function() {
      this.unedit();
      this.model.set({
        pinned: !this.model.attributes.pinned
      });
      if (this.model.attributes.pinned) {
        return this.el.addClass('pinned');
      } else {
        this.el.removeClass('pinned');
        return _.defer(this.model.tick);
      }
    },
    move: function() {
      return this.el.css({
        left: ("" + (this.position().x) + "px"),
        top: ("" + (this.position().y) + "px")
      });
    },
    startDrag: function(e, options) {
      var constant, dragTarget;
      options = (typeof options !== "undefined" && options !== null) ? options : {};
      if (this.el.hasClass('editable')) {
        return null;
      }
      this.el.addClass('dragging');
      constant = 0.01;
      this.dragging = true;
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
      this.drag = function(node) {
        var accel;
        accel = {
          x: (node.attributes.position.x - dragTarget.x) * -constant,
          y: (node.attributes.position.y - dragTarget.y) * -constant
        };
        return accel;
      };
      this.model.forces.push(this.drag);
      return this.el.click(this.endDrag);
    },
    endDrag: function(e) {
      if (!(this.dragging)) {
        return null;
      }
      this.dragging = false;
      this.el.removeClass('dragging');
      $('.document').unbind('mousemove');
      $('.document').unbind('click');
      this.model.forces = _(this.model.forces).without(this.drag);
      if (options.edit) {
        this.edit();
        this.selectContent();
      }
      this.model.eachLink(__bind(function(link) {
        return link.respring();
      }, this));
      this.el.unbind('click');
      return this.el.click(this.startDrag);
    },
    selectContent: function() {
      var range;
      range = document.createRange();
      range.selectNode(this.content[0]);
      return window.getSelection().addRange(range);
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
      _.bindAll(this, 'addObjs', 'addObj', 'removeObj');
      this.collection.bind('refresh', this.addObjs);
      this.collection.bind('add', this.addObj);
      this.collection.bind('remove', this.removeObj);
      this.collection.fetch();
      this.links = new Collections.Links(null, {
        db: this.collection.couch.db
      });
      this.collection.bind('refresh', __bind(function() {
        this.links.bind('refresh', this.addObjs);
        this.links.bind('add', this.addObj);
        this.links.bind('remove', this.removeObj);
        return this.links.fetch();
      }, this));
      this.collection.links = this.links;
      return this.el.dblclick(__bind(function(e) {
        var node;
        if (e.target !== e.currentTarget) {
          return null;
        }
        node = new Models.Node({
          position: {
            x: e.pageX,
            y: e.pageY
          },
          content: 'new node'
        });
        node.editOnWake = true;
        this.collection.add(node);
        return node.save(null);
      }, this));
    },
    removeObj: function(model, col) {
      model.view.el.remove();
      model.couch = col.couch;
      return model.destroy();
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
