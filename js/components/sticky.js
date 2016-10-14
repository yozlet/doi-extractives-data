(function(exports) {
  'use strict';

  var sticky = require('stickyfill')();
  var stickies = [];
  var doc = d3.select(document);

  [].forEach.call(
    document.querySelectorAll('.sticky'),
    function(el) {
      stickies.push(el);
      sticky.add(el);
      var isNav = el.classList.contains('sticky_nav');
      var preSticky = document.createElement('div');
      el.parentNode.insertBefore(preSticky, el)
        .setAttribute('class', 'pre-sticky');

      if (isNav) {
        preSticky.classList.add('pre-sticky-small');
      }
    }
  );

  var watch = function() {
    stickies.forEach(function(sticky) {
      var atTop = d3.select(sticky).style('position');
      var isStuck = sticky.classList.contains('stuck');

      if (atTop && !isStuck) {
        sticky.classList.add('stuck');
      } else if (!atTop && isStuck) {
        sticky.classList.remove('stuck');
      }
    });
  };

  doc.on('scroll.sticky', eiti.util.throttle(watch, 100));
  doc.on('resize.sticky', eiti.util.throttle(watch, 100));

  watch();

  exports.stickyfill = sticky;

})(window);
