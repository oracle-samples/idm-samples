$( document ).ready(function() {
  $('#b1').click(function() {
    $('#box1').fadeToggle();
  });
  $('#b2').click(function() {
    $('#box2').fadeToggle();
  });
  $('#b3').click(function() {
    $('#box3').fadeToggle();
  });
});

//Collapsible menu (top-right)
function topMenu() {
  var x = document.getElementById("myTopnav");
  if (x.className === "topnav") {
    x.className += " responsive";
  } else {
    x.className = "topnav";
  }
}