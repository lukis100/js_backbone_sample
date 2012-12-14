function initialize() {
  
  ///////////////////////////////////////////////////////////
  // Google maps
  ///////////////////////////////////////////////////////////
  var mapOptions = {
    // Chicago - center : new google.maps.LatLng(41.87, -87.62),
    center : new google.maps.LatLng(0, 0),
    zoom : 1,
    mapTypeId : google.maps.MapTypeId.ROADMAP
  };
  var map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
  var markers = [];
  
  // Helper map functions
  function addMarker(latitude, longitude, data, datetime){
    var marker = new google.maps.Marker({
      position : new google.maps.LatLng(latitude, longitude),
      map : map,
    });
    markers.push(marker);
    var infoWindowOptions = {
      content : data + '<br/>' + datetime
    };
    var infoWindow = new google.maps.InfoWindow(infoWindowOptions);
      google.maps.event.addListener(marker, 'click', function(e) {
      infoWindow.open(map, marker);
    });
  }
  
  function clearMarkers(){
    while(markers[0]){
      markers.pop().setMap(null);
    }
  }
      
  ///////////////////////////////////////////////////////////
  // Parse Backbone
  ///////////////////////////////////////////////////////////
    
  Parse.$ = jQuery;
  
  // Parse application javascript keys
  Parse.initialize("KyOuGnBU5s8sgVN9iELyOzpL5WZjHEfLt5A8OCKK", "ANi6UiuvvzI8yeuvLzKBv4SEaOPLU1Aw1opqmbfu"); 
  
  // Models

  var LocationMetadataObject = Parse.Object.extend("LocationMetadataObject", {
    defaults: {
      location: new Parse.GeoPoint({latitude: 0.0, longitude: 0.0}),
      data: "default",
    }
  });
  
  var UserMetadataObject = Parse.Object.extend("UserMetadataObject");
  
  // Helper backbone functions
  
  function addUserLocationsToMap(){
    user = Parse.User.current();
    var query = new Parse.Query(UserMetadataObject);
    query.equalTo("user", user);
    query.first({
      success: function(results) {
        locationsLen = results.get("locations").length;
        for (var x=0; x<locationsLen;x++){
          var query = new Parse.Query(LocationMetadataObject);
          query.equalTo("objectId", results.get("locations")[x].id);
          query.first({
            success: function(results){
              data = results.get("data");
              datetime = results.get("datetime");
              latitude = results.get('location')['latitude'];
              longitude = results.get('location')['longitude'];
              addMarker(latitude, longitude, data, datetime);
            }
          })
        }     
      },
      error: function(error) {
        alert("Error: " + error.code + " " + error.message);
      }
    });
  }
  
  function addUserLocationsToParse(latitude, longitude, data, datetime){
    var user = Parse.User.current();
    var GeoPointObject = new Parse.GeoPoint({latitude: parseFloat(latitude), longitude: parseFloat(longitude)});
    var locationMetadataObject = new LocationMetadataObject();
    locationMetadataObject.set("location", GeoPointObject);
    locationMetadataObject.set("data", data);
    locationMetadataObject.set("datetime", datetime);
      
    var query = new Parse.Query(UserMetadataObject);
    query.equalTo("user", user);
    query.first({
      success: function(results) {
        results.get("locations").push(locationMetadataObject);
        results.save();          
        addMarker(latitude, longitude, data, datetime);
      },
      error: function(error) {
        alert("Error: " + error.code + " " + error.message);
      }
    });
  }
  
  // The Application

  var InputView = Parse.View.extend({
    events: {
      "submit form.input-form": "input",
      "click .log-out": "logOut",
    },

    el: ".content",
    
    initialize: function() {
      _.bindAll(this, "input");
      this.render();
    },

    input: function(e) {
      var self = this;
      var latitude = this.$("#input-latitude").val();
      var longitude = this.$("#input-longitude").val();
      var data = this.$("#input-data").val();
      var date = this.$("#input-date").val();
      var time = this.$("#input-time").val();
      var datetime = date + ' ' + time;
      // Use date.js to figure out the datetime
      if (datetime==' '){
        datetime = new Date(Date.parse('now'));
      }
      else{
        datetime = new Date(Date.parse(datetime));
      }      
      addUserLocationsToParse(latitude, longitude, data, datetime);
      return false;
    },
    
    // Logs out the user and shows the login view
    logOut: function(e) {
      Parse.User.logOut();
      clearMarkers();
      new LogInView();
      this.undelegateEvents();
      delete this;
    },

    render: function() {
      this.$el.html(_.template($("#input-template").html())); 
      this.$("#input-date").datepicker();
      this.delegateEvents();
    }
  });

  var LogInView = Parse.View.extend({
    events: {
      "submit form.login-form": "logIn",
      "submit form.signup-form": "signUp"
    },

    el: ".content",
    
    initialize: function() {
      _.bindAll(this, "logIn", "signUp");
      this.render();
    },

    logIn: function(e) {
      var self = this;
      var username = this.$("#login-username").val();
      var password = this.$("#login-password").val();
      
      Parse.User.logIn(username, password, {
        success: function(user) {
          addUserLocationsToMap();
          new InputView();
          self.undelegateEvents();
          delete self;
        },

        error: function(user, error) {
          self.$(".login-form .error").html("Invalid username or password. Please try again.").show();
          this.$(".login-form button").removeAttr("disabled");
        }
      });

      this.$(".login-form button").attr("disabled", "disabled");

      return false;
    },

    signUp: function(e) {
      var self = this;
      var username = this.$("#signup-username").val();
      var password = this.$("#signup-password").val();
      
      Parse.User.signUp(username, password, { ACL: new Parse.ACL() }, {
        success: function(user) {
          var user = Parse.User.current();
          var UserMetadataObject = Parse.Object.extend("UserMetadataObject");
          var userMetadataObject = new UserMetadataObject();
          userMetadataObject.set("locations", []);
          userMetadataObject.set("user", user);
          // Saves all sub-objects as well
          userMetadataObject.save();
          new InputView();
          self.undelegateEvents();
          delete self;
        },

        error: function(user, error) {
          self.$(".signup-form .error").html(error.message).show();
          this.$(".signup-form button").removeAttr("disabled");
        }
      });

      this.$(".signup-form button").attr("disabled", "disabled");

      return false;
    },

    render: function() {
      this.$el.html(_.template($("#login-template").html()));
      this.delegateEvents();
    }
  });

  // The main view for the app
  var AppView = Parse.View.extend({
    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    el: $("#mapitapp"),

    initialize: function() {
      this.render();
    },

    render: function() {
      if (Parse.User.current()) {
        addUserLocationsToMap();
        new InputView(); 
      } else {
        new LogInView();
      }
    }
  });

  var App = new AppView;

}
