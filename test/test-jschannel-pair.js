defineTests(["jschannel-pair"], function(ChannelPair) {
  var channels;
  
  module("jschannel-pair", {
    setup: function() {
      channels = new ChannelPair("a", "b");

      channels.a.bind("reverse", function(trans, s) {
        if (typeof s !== 'string') {
          throw ["invalid_arguments",
                 'argument to reverse function should be a string'];
        }
        return s.split("").reverse().join("");
      });
    },
    teardown: function() {
      channels.a.destroy();
      channels.b.destroy();
    }
  });
  
  asyncTest("method calls succeed", function() {
    channels.b.call({
      method: "reverse",
      params: "hello world!",
      success: function(v) {
        equal(v, "!dlrow olleh");
        start();
      }
    });
  });
  
  asyncTest("method calls throw", function() {
    channels.b.call({
      method: "reverse",
      params: 1,
      error: function(error, message) {
        equal(error, "invalid_arguments");
        equal(message, "argument to reverse function should be a string");
        start();
      },
      success: function() {
        ok(false, "success should not be called");
        start();
      }
    });
  });
});
