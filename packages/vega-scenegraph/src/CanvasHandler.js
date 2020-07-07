import Handler from './Handler';
import Marks from './marks/index';
import {
  ClickEvent, DragEnterEvent, DragLeaveEvent, DragOverEvent, Events,
  HrefEvent, MouseDownEvent, MouseMoveEvent, MouseOutEvent, MouseOverEvent,
  MouseWheelEvent, TooltipHideEvent, TooltipShowEvent,
  TouchEndEvent, TouchMoveEvent, TouchStartEvent
} from './util/events';
import point from './util/point';
import {domFind} from './util/dom';
import {inherits} from 'vega-util';

export default function CanvasHandler(loader, tooltip) {
  Handler.call(this, loader, tooltip);
  this._down = [];
  this._touch = [];
  this._first = true;
  this._events = {};
  this._actives = [];
}

const prototype = inherits(CanvasHandler, Handler);

prototype.initialize = function(el, origin, obj) {
  this._canvas = el && domFind(el, 'canvas');

  // add minimal events required for proper state management
  [ClickEvent, MouseDownEvent, MouseMoveEvent, MouseOutEvent, DragLeaveEvent]
    .forEach(type => eventListenerCheck(this, type));

  return Handler.prototype.initialize.call(this, el, origin, obj);
};

const eventBundle = type => (
  type === TouchStartEvent ||
  type === TouchMoveEvent ||
  type === TouchEndEvent
)
? [TouchStartEvent, TouchMoveEvent, TouchEndEvent]
: [type];

// lazily add listeners to the canvas as needed
function eventListenerCheck(handler, type) {
  eventBundle(type).forEach(_ => addEventListener(handler, _));
}

function addEventListener(handler, type) {
  const canvas = handler.canvas();
  if (canvas && !handler._events[type]) {
    handler._events[type] = 1;
    canvas.addEventListener(type, handler[type]
      ? evt => handler[type](evt)
      : evt => handler.fire(type, evt)
    );
  }
}

// return the backing canvas instance
prototype.canvas = function() {
  return this._canvas;
};

// retrieve the current canvas context
prototype.context = function() {
  return this._canvas.getContext('2d');
};

// supported events
prototype.events = Events;

function move(moveEvent, overEvent, outEvent) {
  return function(evt) {
    const a = this._actives;
    const p = this.pickEvent(evt);
    const intersect = a.filter(item => p.some(i => i === item));
    const noLongerActive = a.filter(item => !p.some(i => i === item));
    const newItems = p.filter(item => !a.some(i => i === item));

    intersect.forEach((item) => {
      // these items were picked and active.
      this.fire(moveEvent, evt, item); // fire move.
    });

    noLongerActive.forEach((item) => {
      // these items were active but not in picked.
      if (!item || !item.exit) {
        // fire out for item
        // suppress if item was removed from scene
        this.fire(outEvent, evt, item);
      }
    });

    newItems.forEach((item) => {
      this.fire(overEvent, evt, item); // fire over for new item
      this.fire(moveEvent, evt, item); // fire move for new item
    });

    this._actives = [...intersect, ...newItems];
  };
}

function inactive(type) {
  return function(evt) {
    this._actives.forEach((item) => this.fire(type, evt, item));
    this._actives = [];
  };
}

// to keep old versions of firefox happy
prototype.DOMMouseScroll = function(evt) {
  this._actives.forEach((item) => this.fire(MouseWheelEvent, evt, item));
};

prototype.mousemove = move(MouseMoveEvent, MouseOverEvent, MouseOutEvent);
prototype.dragover  = move(DragOverEvent, DragEnterEvent, DragLeaveEvent);

prototype.mouseout  = inactive(MouseOutEvent);
prototype.dragleave = inactive(DragLeaveEvent);

prototype.mousedown = function(evt) {
  this._down = this._actives;
  this._actives.forEach((item) => this.fire(MouseDownEvent, evt, item));
};

prototype.click = function(evt) {
  this._actives.forEach((item) => {
    if (this._down.some(i => i === item)) {
      this.fire(ClickEvent, evt, item);
    }
  });
  this._down = [];
};

prototype.touchstart = function(evt) {
  this._touch = this.pickEvent(evt.changedTouches[0]);

  if (this._first) {
    this._actives = this._touch;
    this._first = false;
  }

  this._touch.forEach(item => this.fire(TouchStartEvent, evt, item));
};

prototype.touchmove = function(evt) {
  this._touch.forEach(item => this.fire(TouchMoveEvent, evt, item));
};

prototype.touchend = function(evt) {
  this._touch.forEach(item => this.fire(TouchEndEvent, evt, item));
  this._touch = [];
};

// fire an event
prototype.fire = function(type, evt, item) {
  const h = this._handlers[type];

  // set event type relative to scenegraph items
  evt.vegaType = type;

  // handle hyperlinks and tooltips first
  if (type === HrefEvent && item && item.href) {
    this.handleHref(evt, item, item.href);
  } else if (type === TooltipShowEvent || type === TooltipHideEvent) {
    this.handleTooltip(evt, item, type !== TooltipHideEvent);
  }

  // invoke all registered handlers
  if (h) {
    for (let i=0, len=h.length; i<len; ++i) {
      h[i].handler.call(this._obj, evt, item);
    }
  }
};

// add an event handler
prototype.on = function(type, handler) {
  const name = this.eventName(type),
        h = this._handlers,
        i = this._handlerIndex(h[name], type, handler);

  if (i < 0) {
    eventListenerCheck(this, type);
    (h[name] || (h[name] = [])).push({
      type:    type,
      handler: handler
    });
  }

  return this;
};

// remove an event handler
prototype.off = function(type, handler) {
  const name = this.eventName(type),
        h = this._handlers[name],
        i = this._handlerIndex(h, type, handler);

  if (i >= 0) {
    h.splice(i, 1);
  }

  return this;
};

prototype.pickEvent = function(evt) {
  const p = point(evt, this._canvas),
        o = this._origin;
  const picked = this.pick(this._scene, p[0], p[1], p[0] - o[0], p[1] - o[1]);
  return (picked && typeof picked.length !== 'undefined') ? picked : [picked];
};

// find the scenegraph item at the current mouse position
// x, y -- the absolute x, y mouse coordinates on the canvas element
// gx, gy -- the relative coordinates within the current group
prototype.pick = function(scene, x, y, gx, gy) {
  const g = this.context(),
        mark = Marks[scene.marktype];
  return mark.pick.call(this, g, scene, x, y, gx, gy);
};
