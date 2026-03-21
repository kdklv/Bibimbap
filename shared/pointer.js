const Pointer = {
  // Per-element set of currently-active pointer IDs, shared across all .on() calls
  // for the same element so that 'move' correctly filters to pressed pointers.
  _active: new WeakMap(),

  _getActive(el) {
    if (!this._active.has(el)) this._active.set(el, new Set());
    return this._active.get(el);
  },

  // el: the canvas element. All coords are relative to el's bounding rect.
  // type: 'down' | 'move' | 'up'
  // cb: ({ x, y, id }) => void
  //   id = 0 for mouse, Touch.identifier for touch/pen
  on(el, type, cb) {
    const active = this._getActive(el);

    function coords(e) {
      const rect = el.getBoundingClientRect();
      return {
        x:  e.clientX - rect.left,
        y:  e.clientY - rect.top,
        id: e.pointerType === 'mouse' ? 0 : e.pointerId,
      };
    }

    if (type === 'down') {
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        active.add(e.pointerId);
        cb(coords(e));
      });

    } else if (type === 'move') {
      // Only fires while the pointer is down — drag semantics.
      el.addEventListener('pointermove', e => {
        if (!active.has(e.pointerId)) return;
        cb(coords(e));
      });

    } else if (type === 'up') {
      const finish = e => {
        if (!active.has(e.pointerId)) return;
        active.delete(e.pointerId);
        cb(coords(e));
      };
      el.addEventListener('pointerup', finish);
      el.addEventListener('pointercancel', finish);
    }
  },
};
