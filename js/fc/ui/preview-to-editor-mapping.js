"use strict";

define(["jquery", "./mark-tracker"], function($, MarkTracker) {
  // Given a descendant of the given root element, returns a CSS
  // selector that uniquely selects only the descendant from the
  // root element.
  function pathTo(root, descendant) {
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
  
  function nodeToCode(node, docFrag) {
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
  
  function getParallelNode(node, docFrag) {
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

  function initEditorSide(livePreview) {
    var codeMirror = livePreview.codeMirror;
    var marks = MarkTracker(codeMirror);
    var chan = livePreview.channelToPreview;
    var docFrag;

    $(".CodeMirror-lines", codeMirror.getWrapperElement())
      .on("mouseup", marks.clear);
    livePreview.on("refresh", function(event) {
      marks.clear();
      docFrag = event.documentFragment;
    });
    chan.bind("ptem:hover", function(trans, selector) {
      marks.clear();
      if (selector && docFrag) {
        var interval = nodeToCode(selector, docFrag);
        if (interval)
          marks.mark(interval.start, interval.end,
                     "preview-to-editor-highlight");
      }
    });
    chan.bind("ptem:mousedown", function(trans, selector) {
      if (!docFrag) return;
      var interval = nodeToCode(selector, docFrag);
      if (interval) {
        var start = codeMirror.posFromIndex(interval.start);
        var startCoords = codeMirror.charCoords(start, "local");
        codeMirror.scrollTo(startCoords.x, startCoords.y);
        codeMirror.focus();
      }
    });
  }
  
  function initPreviewSide(livePreview) {
    var chan = livePreview.channelToEditor;

    livePreview.on("refresh", function(event) {
      $(event.window).on("mousedown", "*", function(event) {
        chan.notify({
          method: "ptem:mousedown",
          params: pathTo(event.target.ownerDocument.body, event.target)
        });
      });
      $(event.window).on("mouseleave", "html", function(event) {
        chan.notify({method: "ptem:hover"});
      });
      $(event.window).on("mouseover", function(event) {
        chan.notify({
          method: "ptem:hover",
          params: pathTo(event.target.ownerDocument.body, event.target)
        });
      });
    });
  }
  
  function PreviewToEditorMapping(livePreview) {
    if (livePreview.channelToEditor) initPreviewSide(livePreview);
    if (livePreview.channelToPreview) initEditorSide(livePreview);
  }
  
  PreviewToEditorMapping._pathTo = pathTo;
  PreviewToEditorMapping._nodeToCode = nodeToCode;
  PreviewToEditorMapping._getParallelNode = getParallelNode;
  
  return PreviewToEditorMapping;
});
