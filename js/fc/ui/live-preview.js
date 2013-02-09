"use strict";

// Displays the HTML source of a CodeMirror editor as a rendered preview
// in an iframe.
define([
  "jquery",
  "backbone-events",
  "jschannel-pair",
  "./live-preview-proxy"
], function($, BackboneEvents, ChannelPair, LivePreviewProxy) {
  function UnifiedOrPreviewSideLivePreview(options) {
    var self = {codeMirror: options.codeMirror, title: ""},
        iframe;
    
    var onReparse = self.onReparse = function(event) {
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
    };

    if (options.codeMirror) options.codeMirror.on("reparse", onReparse);
    if (options.channelToEditor)
      // We're in a child iframe of the real editor, and will use a jschannel
      // to communicate with it.
      self.channelToEditor = options.channelToEditor;
    else
      // We're being run in a unified environment where user JavaScript can
      // adversely affect the editor state; create a pair of "fake"
      // in-window jschannels for preview plugins to use.
      $.extend(self, new ChannelPair("channelToPreview", "channelToEditor"));

    BackboneEvents.mixin(self);

    if (options.plugins)
      options.plugins.forEach(function(plugin) {
        if (self.channelToPreview)
          plugin.initEditorSide(self, self.channelToPreview);
        if (self.channelToEditor)
          plugin.initPreviewSide(self, self.channelToEditor);
      });

    return self;
  };
  
  return function LivePreview(options) {
    if (options.previewFrameURL)
      // The live preview exists in a separate iframe that is (probably) on
      // another domain for security reasons, so return an editor-side
      // proxy that communicates with it.
      return LivePreviewProxy(options);
    else
      // We're either in an iframe that needs to communicate with an
      // editor in a parent window, or running in a unified environment
      // where user JavaScript can arbitrarily affect editor state.
      return UnifiedOrPreviewSideLivePreview(options);
  };
});
