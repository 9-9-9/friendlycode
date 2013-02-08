define(["jquery"], function($) {
  var exports = {};
  
  // Given a descendant of the given root element, returns a CSS
  // selector that uniquely selects only the descendant from the
  // root element.
  var pathTo = exports.pathTo = function(root, descendant) {
    var target = $(descendant).get(0);
    var parts = [];
    var node, nodeName, n, selector;

    for (node = target; node && node != root; node = node.parentNode) {
      nodeName = node.nodeName.toLowerCase();
      n = $(node).prevAll(nodeName).length + 1;
      selector = nodeName + ':nth-of-type(' + n + ')';
      parts.push(selector);
    }
    
    parts.reverse();
    return ' > ' + parts.join(' > ');
  }
  
  var nodeToCode = exports.nodeToCode = function(node, docFrag) {
    var parallelNode = getParallelNode(node, docFrag);
    var result = null;
    if (parallelNode) {
      var pi = parallelNode.parseInfo;
      var isVoidElement = !pi.closeTag;
      result = {
        start: pi.openTag.start,
        end: isVoidElement ? pi.openTag.end : pi.closeTag.end,
        contentStart: isVoidElement ? pi.openTag.start : pi.openTag.end
      };
    }
    return result;
  }

  function getNthChildOfType(node, n, type) {
    var count = 0;
    for (var i = 0; i < node.childNodes.length; i++) {
      if (node.childNodes[i].nodeType == node.ELEMENT_NODE &&
          node.childNodes[i].nodeName == type && ++count == n)
        return node.childNodes[i];
    }
    return null;
  }
  
  var getParallelNode = exports.getParallelNode = function(node, docFrag) {
    var curr = docFrag.querySelector("body") ||
               docFrag.querySelector("html") || docFrag;
    var selector, chunks, match, nodeName, n;
    
    if (typeof(node) == "string")
      selector = node;
    else
      selector = pathTo(node.ownerDocument.body, node);

    chunks = selector.slice(3).split(' > ');
    for (var i = 0; i < chunks.length && curr; i++) {
      match = chunks[i].match(/^([A-Za-z]+):nth-of-type\(([0-9]+)\)$/);
      if (!match) return null;
      nodeName = match[1].toUpperCase();
      n = parseInt(match[2]);
      if (isNaN(n)) return null;
      curr = getNthChildOfType(curr, n, nodeName);
    }
    return curr;
  }

  return exports;
});
