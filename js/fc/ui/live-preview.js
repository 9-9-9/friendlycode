"use strict";

// Displays the HTML source of a CodeMirror editor as a rendered preview
// in an iframe.
define([
  "jquery",
  "backbone-events",
  "jschannel"
], function($, BackboneEvents, Channel) {
  function FakeWindow(name) {
    var listener = null;
    var self = {
      name: name,
      addEventListener: function(event, cb) {
        if (listener) throw new Error("listener already set for " + origin);
        listener = cb;
      },
      postMessage: function(data, origin) {
        setTimeout(function() {
          listener({
            origin: "null",
            data: data,
            source: self.postMessage.source
          });
        }, 0);
      },
      setOther: function(window) {
        self.postMessage.source = window;
        self.channel = self.Channel.build({
          window: window,
          origin: "*",
          scope: "default"
        });
      },
      JSON: window.JSON
    };

    self.Channel = Channel.buildFactory(self);

    return self;
  }
  
  function makeFakeWindows() {
    var editor = FakeWindow("client");
    var preview = FakeWindow("server");

    editor.setOther(preview);
    preview.setOther(editor);

    return {editor: editor, preview: preview};
  }
  
  function LivePreview(options) {
    var self = {codeMirror: options.codeMirror, title: ""},
        codeMirror = options.codeMirror,
        fakeWindows = makeFakeWindows(),
        iframe;

    self.channelToEditor = fakeWindows.preview.channel;
    self.channelToPreview = fakeWindows.editor.channel;
    
    codeMirror.on("reparse", function(event) {
      var isPreviewInDocument = $.contains(document.documentElement,
                                           options.previewArea[0]);
      if (!isPreviewInDocument) {
        if (window.console)
          window.console.log("reparse triggered, but preview area is not " +
                             "attached to the document.");
        return;
      }
      if (!event.error || options.ignoreErrors) {
        var x = 0,
            y = 0,
            doc, wind;
        
        if (iframe) {
          doc = $(iframe).contents()[0];
          wind = doc.defaultView;
          x = wind.pageXOffset;
          y = wind.pageYOffset;
          $(iframe).remove();
        }

        iframe = document.createElement("iframe");
        options.previewArea.append(iframe);
        
        // Update the preview area with the given HTML.
        doc = $(iframe).contents()[0];
        wind = doc.defaultView;

        doc.open();
        doc.write(event.sourceCode);
        doc.close();

        // Insert a BASE TARGET tag so that links don't open in
        // the iframe.
        var baseTag = doc.createElement('base');
        baseTag.setAttribute('target', '_blank');
        doc.querySelector("head").appendChild(baseTag);
        
        // TODO: If the document has images that take a while to load
        // and the previous scroll position of the document depends on
        // their dimensions being set on load, we may need to refresh
        // this scroll position after the document has loaded.
        wind.scroll(x, y);
        
        self.trigger("refresh", {
          window: wind,
          documentFragment: event.document
        });

        if (wind.document.title != self.title) {
          self.title = wind.document.title;
          self.trigger("change:title", self.title);
        }
      }
    });

    BackboneEvents.mixin(self);
    return self;
  };
  
  return LivePreview;
});
