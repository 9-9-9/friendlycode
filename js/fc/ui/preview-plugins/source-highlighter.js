"use strict";

define([
  "jquery",
  "fc/ui/mark-tracker",
  "fc/ui/preview-to-editor-mapping",
  "module"
], function($, MarkTracker, PreviewToEditorMapping, module) {
  var nodeToCode = PreviewToEditorMapping.nodeToCode;
  var pathTo = PreviewToEditorMapping.pathTo;

  return {
    id: module.id,
    initPreviewSide: function(livePreview, chan) {
      livePreview.on("refresh", function(event) {
        $(event.window).on("mousedown", "*", function(event) {
          chan.notify({
            method: "goggles:mousedown",
            params: pathTo(event.target.ownerDocument.body, event.target)
          });
        });
        $(event.window).on("mouseleave", "html", function(event) {
          chan.notify({method: "goggles:hover"});
        });
        $(event.window).on("mouseover", function(event) {
          chan.notify({
            method: "goggles:hover",
            params: pathTo(event.target.ownerDocument.body, event.target)
          });
        });
      });
    },
    initEditorSide: function(livePreview, chan) {
      var codeMirror = livePreview.codeMirror;
      var marks = MarkTracker(codeMirror);
      var docFrag;

      $(".CodeMirror-lines", codeMirror.getWrapperElement())
        .on("mouseup", marks.clear);
      codeMirror.on("reparse", function(event) {
        marks.clear();
        docFrag = event.document;
      });
      chan.bind("goggles:hover", function(trans, selector) {
        marks.clear();
        if (selector && docFrag) {
          var interval = nodeToCode(selector, docFrag);
          if (interval)
            marks.mark(interval.start, interval.end,
                       "preview-to-editor-highlight");
        }
      });
      chan.bind("goggles:mousedown", function(trans, selector) {
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
  };
});
