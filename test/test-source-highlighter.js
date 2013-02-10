"use strict";

defineTests([
  "jquery",
  "fc/ui/preview-plugins/source-highlighter",
  "fc/ui/live-preview",
  "fc/ui/parsing-codemirror",
  "slowparse/slowparse",
  "require"
], function($, SourceHighlighter, LivePreview, ParsingCodeMirror,
            Slowparse, require) {
  var livePreview, livePreviewDiv, codeMirror, codeMirrorDiv;
  var makeDiv = function() {
    return $('<div></div>').appendTo(document.body).css({
      visibility: 'hidden'
    });
  };
  var getHighlight = function() {
    return $(".preview-to-editor-highlight", codeMirrorDiv).text();
  };

  module("source-highlighter", {
    setup: function() {
      codeMirrorDiv = makeDiv();
      livePreviewDiv = makeDiv();
      codeMirror = ParsingCodeMirror(codeMirrorDiv[0], {
        value: "",
        parseDelay: 0,
        parse: function(html) { return Slowparse.HTML(document, html); }
      });
      livePreview = LivePreview({
        codeMirror: codeMirror,
        previewArea: livePreviewDiv,
        plugins: [SourceHighlighter]
      });
    },
    teardown: function() {
      codeMirrorDiv.remove();
      livePreviewDiv.remove();
    }
  });
  
  test("id is valid", function() {
    ok(require(SourceHighlighter.id) === SourceHighlighter);
  });
  
  asyncTest("hovering over element highlights its source", function() {
    livePreview.on("refresh", function(event) {
      $("em", event.window.document).trigger("mouseover");
    });
    livePreview.on("source-highlighter:highlight", function() {
      equal(getHighlight(), "<em>there</em>");
      start();
    });
    codeMirror.setValue("<p>hello <em>there</em></p>");
  });
  
  asyncTest("mousedown on element scrolls to source", function() {
    livePreview.on("refresh", function(event) {
      $("em", event.window.document).trigger("mousedown");
    });
    livePreview.on("source-highlighter:scroll", function(coords) {
      ok(coords.y);
      start();
    });
    codeMirror.setValue("<p>hello \n\n\n\n\n\n<em>there</em></p>");
  });
});
