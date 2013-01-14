/* This Source Code Form is subject to the terms of the MIT license
 * If a copy of the MIT license was not distributed with this file, you can
 * obtain one at https://raw.github.com/mozilla/butter/master/LICENSE */
/*jshint evil:true*/

define( [ "core/logger" ], function( Logger ) {
  /* The Popcorn-Wrapper wraps various functionality and setup associated with
   * creating, updating, and removing associated data with Popcorn.js.
   */
  return function ( mediaId, options ){

    var _id = mediaId,
        _logger = new Logger( _id + "::PopcornWrapper" ),
        _popcornEvents = options.popcornEvents || {},
        _onPrepare = options.prepare || function(){},
        _onFail = options.fail || function(){},
        _onPlayerTypeRequired = options.playerTypeRequired || function(){},
        _onTimeout = options.timeout || function(){},
        _popcorn,
        _mediaReady = false,
        _mediaType,
        _butterEventMap = {},
        _interruptLoad = false,
        _this = this,
        _makeVideoURLsUnique = options.makeVideoURLsUnique;

    /* Destroy popcorn bindings specfically without touching other discovered
     * settings
     */
    this.unbind = function(){
      if ( _popcorn ) {
        try{
          _popcorn.destroy();
          _popcorn = undefined;
        }
        catch( e ){
          _logger.log( "WARNING: Popcorn did NOT get destroyed properly: \n" + e.message + "\n" + e.stack );
        }
      }
    };

    /* Setup any handlers that were defined in the options passed into
     * popcorn wrapper. Events such as timeupdate, paused, etc
     */
    function addPopcornHandlers(){
      for( var eventName in _popcornEvents ){
        if( _popcornEvents.hasOwnProperty( eventName ) ) {
          _popcorn.on( eventName, _popcornEvents[ eventName ] );
        }
      } //for
    } //addPopcornHandlers

    // Cancel loading or preparing of media whilst attempting to setup
    this.interruptLoad = function(){
      _interruptLoad = true;
    }; //interrupt

    // Update Popcorn events with data from a butter trackevent
    this.updateEvent = function( trackEvent ){
      var options = trackEvent.popcornOptions,
          butterId = trackEvent.id,
          popcornId = _butterEventMap[ butterId ],
          popcornEvent = null;
      /* ensure that the trackevent actually exists before removal.
      * we remove the trackevent because there is no easy way
      * to ensure what data has changed on any given track. It
      * is easier to remove the old and create a new trackevent with the updated
      * options
      */
      if( _popcorn ){
        if( popcornId && _popcorn.getTrackEvent( popcornId ) ){
          _popcorn.removeTrackEvent( popcornId );
        } //if
        // make sure the plugin is still included
        if( _popcorn[ trackEvent.type ] ){
          // create the trackevent
          _popcorn[ trackEvent.type ]( options );
          // store a local reference to the newly created trackevent
          _butterEventMap[ butterId ] = _popcorn.getLastTrackEventId();

          popcornEvent = _popcorn.getTrackEvent( _butterEventMap[ butterId ] );
          trackEvent.popcornTrackEvent = popcornEvent;

          if( trackEvent.view ){
            if( popcornEvent.toString ){
              trackEvent.view.setToolTip( popcornEvent.toString() );
            }
            else{
              trackEvent.view.setToolTip( JSON.stringify( options ) );
            }
          }
        } //if
      } //if
    }; //updateEvent

    // Destroy a Popcorn trackevent
    this.destroyEvent = function( trackEvent ){
      var butterId = trackEvent.id,
          popcornId = _butterEventMap[ butterId ];

      // ensure the trackevent actually exists before we remove it
      if( _popcorn ){
        if( popcornId && _popcorn.getTrackEvent( popcornId ) ){
          _popcorn.removeTrackEvent( popcornId );
        } //if

        // remove the reference to the trackevent id that we stored in updateEvent
        delete _butterEventMap[ butterId ];
      } //if
    }; //destroyEvent

    this.setUnderlyingMedia = function(media) {
      if (_popcorn)
        this.unbind();
      _popcorn = Popcorn(media);
      addPopcornHandlers();
      if (!media.duration)
        throw new Error("assertion failure, media must be ready");
      _mediaReady = true;
      _onPrepare();
    };
    
    /* Create functions for various failure and success cases,
     * generate the Popcorn string and ensures our player is ready
     * before we actually create the Popcorn instance and notify the
     * user.
     */
    this.prepare = function( url, target, popcornOptions, callbacks, scripts ){
      /* This is a null-op; clients should call setUnderlyingMedia()
       * instead. */
    };

    /* Determine which player is needed (usually based on the result of findMediaType)
     * and create a stringified representation of the Popcorn constructor (usually to
     * insert in a script tag).
     */
    this.generatePopcornString = function( popcornOptions, url, target, method, callbacks, scripts, trackEvents ){
      throw new Error("not implemented");
    };

    // Passthrough to the Popcorn instances play method
    this.play = function(){
      if ( _mediaReady && _popcorn.paused() ) {
        _popcorn.play();
      }
    };

    // Passthrough to the Popcorn instances pause method
    this.pause = function(){
      if ( _mediaReady && !_popcorn.paused() ) {
        _popcorn.pause();
      }
    };

    // Wipe the current Popcorn instance and anything it created
    this.clear = function( container ) {
      throw new Error("not implemented");
    };

    Object.defineProperties( this, {
      volume: {
        enumerable: true,
        set: function( val ){
          if( _popcorn ){
            _popcorn.volume( val );
          } //if
        },
        get: function(){
          if( _popcorn ){
            return _popcorn.volume();
          }
          return false;
        }
      },
      muted: {
        enumerable: true,
        set: function( val ){
          if( _popcorn ){
            if( val ){
              _popcorn.mute();
            }
            else {
              _popcorn.unmute();
            } //if
          } //if
        },
        get: function(){
          if( _popcorn ){
            return _popcorn.muted();
          }
          return false;
        }
      },
      currentTime: {
        enumerable: true,
        set: function( val ){
          if( _mediaReady && _popcorn ){
            _popcorn.currentTime( val );
          } //if
        },
        get: function(){
          if( _popcorn ){
            return _popcorn.currentTime();
          }
          return 0;
        }
      },
      duration: {
        enumerable: true,
        get: function(){
          if( _popcorn ){
            return _popcorn.duration();
          } //if
          return 0;
        }
      },
      popcorn: {
        enumerable: true,
        get: function(){
          return _popcorn;
        }
      },
      paused: {
        enumerable: true,
        get: function(){
          if( _popcorn ){
            return _popcorn.paused();
          } //if
          return true;
        },
        set: function( val ){
          if( _popcorn ){
            if( val ){
              _this.pause();
            }
            else {
              _this.play();
            } //if
          } //if
        }
      } //paused
    });

  };

});
