// TODOS:
//
// * Mouseover of DOM elements in preview area should highlight the relevant
//   source code.
//
// * Cursor-over of attributes on page should show relevant
//   MDN help tooltip, with link to more information on MDN (e.g. via
//   shift-click).
//
// * On mouseover of word "here" in error message, the associated source code
//   should scroll into view if not already visible.
//
// * Suggestions for unrecognized tags/properties/attrs should have MDN
//   blurbs next to them.
//
// * We should detect unrecognized attributes for the current tag and
//   provide suggestions for those.
//
// * Images that don't load should also dim the preview area and provide
//   help atop it, e.g. telling the user to check the URL and make sure
//   it's an image and not a web page. Relevant source code should
//   be highlighted.

// The CodeMirror2 editor instance.
var editor;

// A mapping from character indices in the editor to associated
// context-sensitive help information.
var helpIndex = [];

// Keep track of CodeMirror2 mark objects corresponding to help
// highlighting.
var cursorHelpMarks = [];

// Select the given {start,end} interval in the editor.
function selectInterval(interval) {
  var start = editor.coordsFromIndex(interval.start);
  var end = editor.coordsFromIndex(interval.end);
  editor.setSelection(start, end);
  editor.focus();
}

// When the user moves over anything with a data-highlight attribute,
// select the text in the editor that corresponds to the highlight.
$(document).on("mouseover", "[data-highlight]", function(event) {
  selectInterval($(this).errorHighlightInterval());
});

// This is the reverse of CodeMirror2's editor.coordsFromIndex().
function getIndexFromPos(editor, pos) {
  var index = pos.ch;
  for (var i = 0; i < pos.line; i++)
    index += editor.getLine(i).length + 1;
  return index;
}

// Recursively build the help index mapping editor character indices 
// to context-sensitive help.
function buildHelpIndex(element, index) {
  var i, child,
      html = editor.getValue(),
      pi = element.parseInfo,
      tagInfo = {
        type: "tag",
        value: element.nodeName.toLowerCase(),
        highlights: []
      };
  if (pi) {
    if (pi.openTag) {
      tagInfo.highlights.push(pi.openTag);
      for (i = pi.openTag.start; i < pi.openTag.end; i++)
        index[i] = tagInfo;
    }
    if (pi.closeTag) {
      tagInfo.highlights.push(pi.closeTag);
      for (i = pi.closeTag.start; i < pi.closeTag.end; i++)
        index[i] = tagInfo;
    }
  }
  for (i = 0; i < element.childNodes.length; i++) {
    child = element.childNodes[i];
    if (child.nodeType == element.ELEMENT_NODE) {
      buildHelpIndex(child, index);
    }
    if (element.nodeName == "STYLE" && child.parseInfo.rules) {
      child.parseInfo.rules.forEach(function(rule) {
        var selectorInfo = {
          type: "cssSelector",
          highlights: [rule.selector]
        };
        for (var i = rule.selector.start; i < rule.selector.end; i++)
          index[i] = selectorInfo;
        rule.declarations.properties.forEach(function(prop) {
          var cssInfo = {
            type: "cssProperty",
            value: html.slice(prop.name.start, prop.name.end).toLowerCase(),
            highlights: [prop.name]
          };
          for (var i = prop.name.start; i < prop.name.end; i++)
            index[i] = cssInfo;
        });
      });
    }
  }
}

// Return the context-sensitive help information for a particular position
// in the editor, or undefined if no help is available.
function getHelp(pos) {
  var index = getIndexFromPos(editor, pos),
      help = helpIndex[index];
  if (help) {
    if (help.type == "tag" &&
        help.value in HacktionaryData["html-element-docs"])
      return {
        html: HacktionaryData["html-element-docs"][help.value],
        url: MDN_URLS.html + help.value,
        highlights: help.highlights
      };
    else if (help.type == "cssProperty" &&
             help.value in HacktionaryData["css-property-docs"])
      return {
        html: HacktionaryData["css-property-docs"][help.value],
        url: MDN_URLS.css + help.value,
        highlights: help.highlights
      };
    else if (help.type == "cssSelector")
      return {
        html: $("#templates .selector-help").html(),
        url: MDN_URLS.cssSelectors,
        highlights: help.highlights
      };
  }
}

// URLs for help on the Mozilla Developer Network.
var MDN_URLS = {
  html: "https://developer.mozilla.org/en/HTML/Element/",
  css: "https://developer.mozilla.org/en/CSS/",
  cssSelectors: "https://developer.mozilla.org/en/CSS/Getting_Started/Selectors"
};

// Report the given Slowparse error.
function reportError(error) {
  $(".error").fillError(error).eachErrorHighlight(setErrorHighlight);
  $(".help").hide();
}

// Assuming "this" is an element with a data-highlight attribute,
// give the highlighted text interval in the editor a numbered error
// highlight class.
function setErrorHighlight(start, end, i) {
  var className = "highlight-" + (i+1);
  var start = editor.coordsFromIndex(start);
  var end = editor.coordsFromIndex(end);
  var mark = editor.markText(start, end, className);
  $(this).addClass(className).data("mark", mark);
}

// Remove all highlights made by setErrorHighlight().
function clearErrorHighlights() {
  $(".error").eachErrorHighlight(function() {
    // Odd, from the CodeMirror docs you'd think this would remove
    // the class from the highlighted text, too, but it doesn't.
    // I guess we're just garbage collecting here.
    $(this).data("mark").clear();
  });
  for (var i = 1; i <= 5; i++)
    $(".CodeMirror .highlight-" + i).removeClass("highlight-" + i);
}

// Update the preview area with the given HTML.
function updatePreview(html) {
  $(".error").hide();
  var doc = $(".preview").contents()[0];
  doc.open();
  doc.write(html);
  doc.close();
}

// Called whenever content of the editor area changes.
function onChange() {
  var html = editor.getValue();
  var result = Slowparse.HTML(document, html, [TreeInspectors.forbidJS]);
  helpIndex = [];  
  clearErrorHighlights();
  if (result.error)
    reportError(result.error);
  else {
    buildHelpIndex(result.document, helpIndex);
    updatePreview(html);
  }
  // Cursor activity would've been fired before us, so call it again
  // to make sure it displays the right context-sensitive help based
  // on the new state of the document.
  onCursorActivity();
}

// Called whenever the user moves their cursor in the editor area.
function onCursorActivity() {
  $(".CodeMirror .highlight").removeClass("cursor-help-highlight");
  cursorHelpMarks.forEach(function(mark) {
    // Odd, from the CodeMirror docs you'd think this would remove
    // the class from the highlighted text, too, but it doesn't.
    // I guess we're just garbage collecting here.
    mark.clear();
  });
  cursorHelpMarks = [];
  var help = getHelp(editor.getCursor());
  if (help) {
    var learn = $("#templates .learn-more").clone()
      .attr("href", help.url);
    $(".help").html(help.html).append(learn).show();
    help.highlights.forEach(function(interval) {
      var start = editor.coordsFromIndex(interval.start);
      var end = editor.coordsFromIndex(interval.end);
      var mark = editor.markText(start, end, "cursor-help-highlight");
      cursorHelpMarks.push(mark);
    });
  } else
    $(".help").hide();
}

$(window).load(function() {
  // The number of milliseconds to wait before refreshing the preview
  // content and checking the user's HTML for errors.
  var ON_CHANGE_DELAY = 300;
  var onChangeTimeout;
  
  $(".html").val($("#initial-html").text().trim());
  jQuery.loadErrors("slowparse/spec/", ["base", "forbidjs"], function() {
    editor = CodeMirror.fromTextArea($(".html")[0], {
      mode: "text/html",
      theme: "jsbin",
      tabMode: "indent",
      lineWrapping: true,
      lineNumbers: true,
      onChange: function() {
        clearTimeout(onChangeTimeout);
        onChangeTimeout = setTimeout(onChange, ON_CHANGE_DELAY);
      },
      onCursorActivity: onCursorActivity
    });
    editor.focus();
    onChange();
    onCursorActivity();
    $(window).trigger("editorloaded");
  });
});
