define([
  "jquery",
  "underscore",
  "fc/ui/mark-tracker",
  "fc/ui/preview-to-editor-mapping"
], function($, _, MarkTracker, PreviewToEditorMapping) {
  var getParallelNode = PreviewToEditorMapping._getParallelNode;
  var nodeToCode = PreviewToEditorMapping._nodeToCode;

  function ButterBar(butterIframe) {
    var self = {};
    var editor = null;
    var lastDocFrag = null;
    var lastPreviewWindow = null;
    var Instapoppin = null;
    var marks = null;
    var butterWindow = butterIframe.contentWindow;
    var Butter = butterWindow.Butter;
    var tray = butterWindow.document.querySelector(".butter-tray");
    var maybeRemoveFromCode = [];
    var checkIfReallyRemoved;
    var previewMediaReady = function(event) {
      var previewMedia = event.window.Instapoppin.pop.media;
      var media = Butter.app.currentMedia;
      
      previewMedia.currentTime = media.currentTime;
      media.url = "#t=," + previewMedia.duration;
      media.tracks.slice().forEach(function(track) {
        media.removeTrack(track);
      });
      maybeRemoveFromCode = [];
      lastPreviewWindow = event.window;
      Instapoppin = event.window.Instapoppin;
      lastDocFrag = event.documentFragment;

      Instapoppin.getParticipatingElements().forEach(function(elem) {
        var durations = Instapoppin.getActiveDurations(elem);
        durations.forEach(function(duration) {
          if (!media.tracks.length)
            Butter.app.currentMedia.addTrack();
          var track = media.tracks[0];
          var text = _.escape(elem.textContent) ||
                     '&lt;' + elem.nodeName.toLowerCase() + '&gt;';
          var trackEvent = track.addTrackEvent({
            type: "html",
            popcornOptions: {
              _element: elem,
              start: duration.start,
              end: duration.end,
              html: text
            }
          });
          trackEvent.view.element._trackEvent = trackEvent;
        });
      });
    };

    butterIframe.style.height = tray.offsetHeight + "px";
    
    self.bindToEditor = function(friendlycodeEditor) {
      editor = friendlycodeEditor;
      editor.editor.container.attr("style",
        "height: calc(100% - " + tray.offsetHeight + "px);" +
        "height: -webkit-calc(100% - " + tray.offsetHeight + "px);"
      );
      editor.codeMirror.refresh();
      marks = MarkTracker(editor.codeMirror);

      $(tray).on("mouseenter", ".butter-track-event", function(e) {
        var target = e.target;
        if (!$(target).hasClass("butter-track-event"))
          target = $(target).closest(".butter-track-event").get(0);
        marks.clear();
        var trackEvent = target._trackEvent;
        if (lastPreviewWindow && trackEvent) {
          var codeElement = trackEvent.popcornOptions._element;
          if (codeElement && 
              codeElement.ownerDocument === lastPreviewWindow.document) {
            var interval = nodeToCode(codeElement, lastDocFrag);
            if (interval) {
              marks.mark(interval.start, interval.end,
                         "preview-to-editor-highlight");
            }
          }
        }
      });
      $(tray).on("mouseleave", ".butter-track-event", function(e) {
        marks.clear();
      });
      Butter.app.listen("trackeventadded", function(e) {
        var index = maybeRemoveFromCode.indexOf(e.data);
        if (index != -1)
          maybeRemoveFromCode.splice(index, 1);
      });
      Butter.app.listen("trackeventremoved", function(e) {
        maybeRemoveFromCode.push(e.data);
        clearTimeout(checkIfReallyRemoved);
        checkIfReallyRemoved = setTimeout(function() {
          maybeRemoveFromCode.forEach(function(data) {
            var po = data.popcornOptions;
            if (Instapoppin && po._element &&
                po._element.ownerDocument === lastPreviewWindow.document) {
              var info = nodeToCode(po._element, lastDocFrag);
              editor.codeMirror.replaceRange("",
                editor.codeMirror.posFromIndex(info.start),
                editor.codeMirror.posFromIndex(info.end)
              );
            }
          });
          maybeRemoveFromCode = [];
        }, 0);
      });
      Butter.app.listen("trackeventupdated", function(e) {
        var po = e.data.popcornOptions;
        if (Instapoppin && po._element &&
            po._element.ownerDocument === lastPreviewWindow.document) {
          var dur = Instapoppin.getActiveDurations(po._element);
          if (dur[0].start.toFixed(4) != po.start.toFixed(4) ||
              dur[0].end.toFixed(4) != po.end.toFixed(4)) {
            var codeNode = getParallelNode(po._element, lastDocFrag);
            for (var i = 0; i < codeNode.attributes.length; i++) {
              var attr = codeNode.attributes[i];
              if (attr.nodeName == "data-active-during") {
                var valuePi = attr.parseInfo.value;
                editor.codeMirror.replaceRange(
                  po.start.toFixed(4) + "-" + po.end.toFixed(4),
                  editor.codeMirror.posFromIndex(valuePi.start+1),
                  editor.codeMirror.posFromIndex(valuePi.end-1)
                );
              }
            }
          }
        }
      });
      Butter.app.currentMedia.listen("mediaplay", function() {
        if (!Instapoppin) return;
        Instapoppin.pop.media.play();
        console.log("PLAY");
      });
      Butter.app.currentMedia.listen("mediapause", function() {
        if (!Instapoppin) return;
        Instapoppin.pop.media.pause();
        console.log("PAUSE");
      });
      Butter.app.currentMedia.listen("mediatimeupdate", function(e) {
        if (!Instapoppin || !Instapoppin.pop) return;
        if (Instapoppin.pop.media.paused &&
            Instapoppin.pop.media.duration)
          Instapoppin.pop.media.currentTime = e.target.currentTime;
      });

      editor.editor.panes.preview.on("refresh", function(event) {
        Instapoppin = null;
        lastDocFrag = null;
        lastPreviewWindow = null;
        var documentElement = event.window.document.documentElement;
        documentElement.addEventListener("instapoppinactive", function(e) {
          var previewMedia = event.window.Instapoppin.pop.media;
          var syncDuration = function() {
            // We shouldn't have to do this setTimeout, but media elements
            // with controls seem to not cause popcorn to be notified if
            // we do it without a timeout in Chrome.
            event.window.setTimeout(function() {
              previewMediaReady(event);
            }, 100);
          };
          if (!previewMedia.duration)
            previewMedia.addEventListener("loadedmetadata", syncDuration, 
                                          false);
          else
            syncDuration();
        }, true);
      });
    };
    
    return self;
  };
  
  var exports = {
    create: function(src, onReady) {
      var iframe = document.createElement("iframe");
      iframe.setAttribute("class", "butter");
      iframe.src = "butter/templates/basic/";
      document.body.appendChild(iframe);
      var interval = setInterval(function() {
        var w = iframe.contentWindow;
        // app.project is defined just before ready event is fired, so
        // it's a proxy for that.
        if (w.Butter && w.Butter.app && w.Butter.app.project) {
          clearInterval(interval);
          onReady(new ButterBar(iframe));
        }
      }, 50);
    }
  };

  return exports;
});
