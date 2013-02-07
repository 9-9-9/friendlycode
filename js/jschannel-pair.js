define(["jschannel"], function(Channel) {
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
  
  function makeFakeWindows(aName, bName) {
    var a = FakeWindow(aName);
    var b = FakeWindow(bName);

    a.setOther(b);
    b.setOther(a);

    return [a, b];
  }
  
  return function ChannelPair(aName, bName) {
    var windows = makeFakeWindows(aName, bName);
    
    this[aName] = windows[0].channel;
    this[bName] = windows[1].channel;
  }
});
