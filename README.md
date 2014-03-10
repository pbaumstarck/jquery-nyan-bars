jquery-nyan-bars
================

Animated text and progress bars parsed from a simple string language.

View a demo instance at: http://nyanbars.appspot.com/

Blog post at: http://webronomicon.blogspot.com/2014/03/nyan-bars.html

Create a progress bar:

```javascript
  $("#bar").nyanBar({
    charSize: charSize, // How many character to take up.
    pattern: "-*>", // The pattern to parse.
    showProgress: true, // Whether to show a percentage.
    progressFunction: (function() {
      var ctr = 0;
      return function() {
        ctr = (ctr + 1) % 100;
        return ctr;
      }
    })() // The function that is queried for progress.
  });
```

The language is simple. Say that a character or sequence should be repeated with the `*` character:

```javascript
  var pattern = "-*>";
  // Implies ==>
  ->
  -->
  --->
  ---->
  ---->
  ---->
```

Animate a single character with the `[]` operator, separating groups of characters with `|`s:

```javascript
  var pattern = "[A|a]";
  // ==>
  A
   a
    A
     a
     A
     a
```

There can be as many groups of characters in a `[]` as you want, so long as they are all of the same length. 

Include repetition with the `*`:

```javascript
  var pattern = "[A|a]*";
  // ==>
  A
  Aa
  AaA
  AaAa
  AaAa
  AaAa
```

Make the characters continually animated with the `{}` operator:

```javascript
  var pattern = "{A|a}*";
  // ==>
  A
  aA
  AaA
  aAaA
  AaAa
  aAaA
```

Make them animate in unison with the `{{}}` operator:

```javascript
  var pattern = "{{A|a}}*";
  // ==>
  A
  aa
  AAA
  aaaa
  AAAA
  aaaa
```

And make `{}`-animated characters run their animation in reverse by using the `+` operator instead of `*`:

```javascript
  var pattern = "{1|2|3}*";
  // ==>
  1
  21
  321
  1321
  2132
  3213
```

```javascript
  var pattern = "{1|2|3}+";
  // ==>
  1
  23
  312
  1231
  2312
  3123
```
