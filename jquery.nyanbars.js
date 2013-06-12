
(function($) {
  // An enum for what kinds of animation cells may possess.
  var EAnimation = {
    NONE: "none",
    REGULAR: "regular",
    INDIVIDUAL: "individual",
    UNIFORM: "uniform"
  };

  // A segment in a text progress bar, which can be multi-character, and support
  // animation.
  // Parameters:
  //   args: A record of:
  //     'windows': A list of the text segments to alternate between, or a single
  //       text value.
  //     'windowIx': The starting index to use in the 'windows'.
  //     'text': A single text segment to use, if there are no windows.
  //     'fecund': Whether this node should reproduce itself.
  //     'animation': An 'EAnimation' for how the node should animate.
  //     'last': A node to splice this into as its successor.
  function Segment(args) {
    if (args === undefined) {
      return;
    }
    if (args.text) {
      this.windows = [args.text];
    } else if (args.windows) {
      this.windows = args.windows;
    } else {
      this.windows = [""];
    }
    // What index we are in the window.
    this.windowIx = (args.windowIx || 0) % this.windows.length;

    this.fecund = args.fecund || false;
    this.direction = args.direction || 1;
    this.wasFecund = this.fecund;
    this.animation = args.animation || EAnimation.NONE;

    // The previous 'Segment' we are linked to.
    this.prev = null;
    // The next 'Segment' we are linked to.
    this.next = null;
    if (args.last) {
      var next = args.last.next;
      args.last.next = this;
      this.prev = args.last;
      if (next) {
        this.next = next;
        next.prev = this;
      }
    }

    // Assert the windows are all of the same size.
    this.length = undefined;
    for (var i = 0; i < this.windows.length; ++i) {
      var length = this.windows[i].length;
      if (this.length === undefined) {
        this.length = length;
      } else if (length != this.length) {
        throw new Error("Segment cannot have segments of different lengths.");
      }
    }
  }

  // Copies this node.
  Segment.prototype.clone = function() {
    var clone = new Segment({
      windows: this.windows,
      windowIx: this.windowIx,
      fecund: this.fecund,
      direction: this.direction,
      animation: this.animation
    });
    if (this.next) {
      var nextClone = this.next.clone();
      clone.next = nextClone;
      nextClone.prev = clone;
    }
    return clone;
  };

  // Gets the full length of all connected components.
  // Args:
  //   numSteps: The number of steps forward of animation to consider.
  Segment.prototype.getFullLength = function(numSteps) {
    if (numSteps === undefined) {
      numSteps = 0;
    }
    var head = this;
    var fullLength = 0;
    while (head) {
      fullLength += head.length * (head.fecund * numSteps + 1);
      head = head.next;
    }
    return fullLength;
  };

  // Returns the string representation of the sequence.
  Segment.prototype.getSequenceString = function() {
    var strs = [];
    var head = this;
    while (head) {
      strs.push(head.toString());
      head = head.next;
    }
    return strs.join("");
  };

  // Returns the string representation of just this segment.
  Segment.prototype.toString = function() {
    return this.windows[this.windowIx];
  };

  // Get the updated window index after applying the offset.
  Segment.prototype.getOffsetIx = function(offset) {
    var ix = this.windowIx + offset;//(this.direction == 1 ? offset : -offset);
    while (ix < 0) {
      ix += this.windows.length;
    }
    return ix % this.windows.length;
  }

  // Updates the entire pipeline, performinig animation.
  // Parameters:
  //   generations: The number of generations to produce.
  Segment.prototype.update = function(generations) {
    var next = this.next;
    this.wasFecund |= this.fecund;
    if (!generations) {
      generations = 0;
    } else if (generations === true) {
      generations = 1;
    }
    if (generations > 0 && this.fecund) {
      // We are live, so we have to spawn a successor.
      var succ = this;
      var tmpGenerations = generations;
      while (tmpGenerations) {
        // var nextIx = this.windowIx;
        var offset = 0;
        if (this.animation == EAnimation.NONE) {
          // Pass.
        } else if (this.animation == EAnimation.REGULAR) {
          offset = generations - tmpGenerations + 1;
        } else if (this.animation == EAnimation.INDIVIDUAL) {
          if (this.direction == 1) {
            offset = tmpGenerations - 1;
          } else {
            offset = generations + generations - (tmpGenerations - 1);
          }
        } else if (this.animation == EAnimation.UNIFORM) {
          offset = 1;
        }
        var newSucc = new Segment({
          windows: succ.windows,
          windowIx: this.getOffsetIx(offset),
          animation: succ.animation,
          last: succ,
          fecund: tmpGenerations == 1,
          direction: succ.direction
        });
        succ.wasFecund = true;
        succ = newSucc;
        --tmpGenerations;
      }
      succ.wasFecund = true;
      this.fecund = false;
    }
    var offset = 0;
    if (this.animation == EAnimation.NONE) {
      // Pass.
    } else if (this.animation == EAnimation.REGULAR) {
      if (!this.wasFecund) {
        offset = Math.max(1, generations);
      }
    } else if (this.animation == EAnimation.INDIVIDUAL) {
      offset = Math.max(1, generations);
    } else if (this.animation == EAnimation.UNIFORM) {
      offset = 1;
    }
    this.windowIx = this.getOffsetIx(offset);//this.direction * offset);

    if (next) {
      next.update(generations);
    }
  };


  MultiSegment.prototype = new Segment();
  MultiSegment.prototype.constructor = MultiSegment;
  MultiSegment.prototype.parent = Segment.prototype;
  // A multi-line segment.
  // Parameters:
  //   args: A record type of:
  //     'patterns': A list of the 'Segment's objects or strings to parse.
  //     'last': A node to splice this into as its successor.
  function MultiSegment(args) {
    this.patterns = [];
    if (args.patterns) {
      for (var i = 0; i < args.patterns.length; ++i) {
        var bar = args.patterns[i];
        if (bar instanceof Segment) {
          this.patterns.push(bar);
        } else if (typeof bar == "string") {
          this.patterns.push(parseNyanBar(bar));
        } else {
          throw new Error("Bad input for 'Segment'");
        }
      }
    }
  }

  // Clones this node.
  MultiSegment.prototype.clone = function() {
    var patterns = [];
    for (var i = 0; i < this.patterns.length; ++i) {
      patterns.push(this.patterns[i].clone());
    }
    return new MultiSegment({
      patterns: patterns
    });
  };

  // Gets the full length of all connected components.
  // Args:
  //   numSteps: The number of steps forward of animation to consider.
  MultiSegment.prototype.getFullLength = function(numSteps) {
    var max = 0;
    for (var i = 0; i < this.patterns.length; ++i) {
      max = Math.max(max, this.patterns[i].getFullLength(numSteps));
    }
    return max;
  };

  // Returns the string representation of the sequence.
  MultiSegment.prototype.getSequenceString = function() {
    var strs = [];
    for (var i = 0; i < this.patterns.length; ++i) {
      strs.push(this.patterns[i].getSequenceString());
    }
    return strs.join("\n");
  };

  // Returns the string representation of just this segment.
  MultiSegment.prototype.toString = function() {
    return this.getSequenceString();
  };

  // Updates the entire pipeline, performinig animation.
  // Parameters:
  //   generations: The number of generations to produce.
  MultiSegment.prototype.update = function(generations) {
    for (var i = 0; i < this.patterns.length; ++i) {
      this.patterns[i].update(generations);
    }
  };


  if (false) {
    var key = "KHAN!";
    var root = new Segment({
      text: key.charAt(0)
    });
    for (var j = 0; j <= 2; ++j) {
      var animation;
      if (j == 0) {
        animation = EAnimation.NONE;
      } else if (j == 1) {
        animation = EAnimation.REGULAR;
      } else {
        animation = EAnimation.UNIFORM;
      }
      var rootClone = root.clone();
      var node = rootClone;
      for (var i = 1; i < key.length; ++i) {
        if (i == 2) {
          node = new Segment({
            fecund: true,
            last: node,
            animation: animation,
            windows: ["_", "\\", "/"]
          });
        } else if (i == 2) {
          var _char = key.charAt(i);
          node = new Segment({
            fecund: true,
            last: node,
            animation: animation,
            windows: [_char.toUpperCase(), _char.toLowerCase()]
          });
        } else if (i == key.length - 1) {
          node = new Segment({
            last: node,
            windows: ["!", "?"],
            animation: animation
          });
        } else {
          node = new Segment({
            fecund: i == 2,
            last: node,
            text: key.charAt(i)
          });
        }
      }
      console.log(rootClone.getSequenceString());

      for (var i = 0; i < 8; ++i) {
        rootClone.update(3);
        console.log(rootClone.getSequenceString());
      }
      for (var i = 0; i < 4; ++i) {
        rootClone.update();
        console.log(rootClone.getSequenceString());
      }
    }
  }

  function parseNyanBar(text) {
    // Use the arguments to make a new head node and attach it to the list,
    // updating all members.
    var makeHead = function(headArgs) {
      var head = new Segment(headArgs);
      if (!root) {
        root = head;
        tail = head;
      } else {
        tail.next = head;
        head.prev = tail;
        tail = head;
      }
      return head;
    };

    var ix = 0;
    var escaped = false;
    // The first 'Segment' we parsed.
    var root = null;
    // The last 'Segment' we have parsed.
    var tail = null;
    // Arguments we are collecting for the head node.
    var headArgs = null;
    // A segment we have just completed.
    var justCompleted = null;
    // Text we have in the buffer.
    var buffer = "";
    // Whether any fecund nodes have been detected.
    var anyFecund = false;
    if (text == null) {
      text = "";
    }
    for (; ix < text.length; ++ix) {
      var c = text.charAt(ix);
      if (false) {
        console.log("ix:" + ix + " c:" + c + " E:" + (escaped ? "1" : "0") +
            " R:" + (root ? "1" : "0") + " T:" + (tail ? "1" : "0") +
            " HA:" + (headArgs ? "1" : "0") + " JC:" + (justCompleted ? "1" : "0") +
            " CC:" + (headArgs ? headArgs.closeChar : "") +
            " W:" + (headArgs ? (headArgs.windows.length ? "1" : "0") : "-") +
            " AF:" + (anyFecund ? "1" : "0") + " B: " + buffer);
      }
      if (escaped) {
        buffer += c;
        justCompleted = null;
        escaped = false;
      } else if (c == "\\") {
        escaped = true;
        justCompleted = null;
      } else {
        escaped = false;
        if (headArgs) {
          // We're parsing a segment.
          if (c == "{" && headArgs.closeChar == "}" && !headArgs.windows.length) {
            // We just parsed the opening '{', so this is a double '{{'.
            headArgs.animation = EAnimation.UNIFORM;
            headArgs.closeChar += "}";
            justCompleted = null;
          } else if (c == headArgs.closeChar.substr(0, 1)) {
            // Consume a closing character.
            headArgs.closeChar = headArgs.closeChar.substr(1);
            if (!headArgs.closeChar) {
              // Close the segment, and dump the last group.
              headArgs.windows.push(buffer);
              buffer = "";
              justCompleted = makeHead(headArgs);
              headArgs = null;
            } else {
              justCompleted = null;
            }
          } else if (c == "|") {
            // Close the current text slice.
            headArgs.windows.push(buffer);
            buffer = "";
            justCompleted = null;
          } else {
            // Just add to the current slice.
            buffer += c;
            justCompleted = null;
          }
        } else {
          if (/*c == "(" ||*/ c == "[" || c == "{") {
            // Open a new segment, but dump the buffer first.
            if (buffer) {
              makeHead({
                text: buffer
              });
            }
            headArgs = {
              windows: [],
              // animation: c == "(" ? EAnimation.NONE : (
              //     c == "[" ? EAnimation.REGULAR : EAnimation.UNIFORM),
              // // The character that signals the close of the thing.
              // closeChar: c == "(" ? ")" : (c == "[" ? "]" : "}")
              animation: c == "[" ? EAnimation.REGULAR : EAnimation.INDIVIDUAL,
              // The character that signals the close of the thing.
              closeChar: c == "[" ? "]" : "}"
            };
            buffer = "";
            justCompleted = null;
          } else if (c == "*" || c == "+") {
            if (justCompleted) {
              // Mark the completed segment as a fecund one.
              justCompleted.fecund = true;
              justCompleted.direction = c == "*" ? 1 : -1;
              justCompleted = null;
              anyFecund = true;
            } else if (buffer) {
              // Dump the buffer and make the last character repeating.
              if (buffer.length > 0) {
                makeHead({
                  text: buffer.substr(0, buffer.length - 1)
                });
              }
              makeHead({
                text: buffer.charAt(buffer.length - 1),
                fecund: true
              });
              buffer = "";
              justCompleted = null;
              anyFecund = true;
            } else {
              // This was just a plain '*'.
              buffer += c;
              justCompleted = null;
            }
          } else {
            buffer += c;
            justCompleted = null;
          }
        }
      }
    }
    if (buffer) {
      // Dump the last buffer.
      makeHead({
        text: buffer
      });
    } else if (!root) {
      root = new Segment({
        text: "*",
        fecund: true
      });
      anyFecund = true;
    }
    if (!anyFecund) {
      // Add a replicating space to the start of the thing.
      var space = new Segment({
        text: " ",
        fecund: true
      });
      space.next = root;
      root.prev = space;
      root = space;
    }
    return root;
  }

  // [A|a] -> No animation, just pick values upon creation. // Meaningless.
  // [A|a]* -> No animation, just pick values upon creation.
  // {A|a}* -> Replication,

  // NEED:
  // - Replication, no animation. --> [asdf]*
  // - Replication, individual animation. --> [A|a]*
  // - Replication, synchronized animation. --> {A|a}*
  // - No replication, animation. --> [A|a], {A|a}

  // [A|a] -> Animated single cell.
  // [A|a]* -> Replication, and uniform single cells.
  // {A|a}* -> Replication, and individual animation of cells.
  // {{A|a}}* -> Replication, and uniform animation of cells.
  var nyanBars = [
      "KHAN!",
      "KHA*N!",
      "KHA\\*N!",
      "*KHA\\**N!",
      "single square: [A|a].",
      "single curly: {A|a}.",
      "double curly: {{A|a}}.",
      "single square star: [A|a]*.",
      "single curly star: {A|a}*.",
      "double curly star: {{A|a}}*.",
      new MultiSegment({
        patterns: ["[/|\\\\]*", "[\\\\|/]*"]
      })
      //"~*",
      //"[~|=]*\\[[.|,]x[,|.]\\][:|:|:|\\|]3",
      //"{_|/|\\\\|_}*"
  ];
  for (var j = 0; j < nyanBars.length; ++j) {
    var nyanBar = nyanBars[j];
    if (typeof nyanBar == "string") {
      nyanBar = parseNyanBar(nyanBar);
    }
    console.log(nyanBar.getSequenceString());
    for (var i = 0; i < 4; ++i) {
      nyanBar.update(4);
      console.log(nyanBar.getSequenceString());
      nyanBar.update(3);
      console.log(nyanBar.getSequenceString());
    }
    for (var i = 0; i < 4; ++i) {
      nyanBar.update(0);
      console.log(nyanBar.getSequenceString());
    }
  }

  $.fn.nyanBar = function(options) {
    this.each(function() {
      if (options === undefined) {
        options = {};
      }
      var div = this;
      // The size of the area to be rendered into.
      var charSize = options.charSize || 100;
      var updatePeriod = options.updatePeriod || 500;
      var progressFunction = options.progressFunction || function() { return 0; };
      var bookends = options.bookends || "|";
      var showProgress = options.showProgress || false;
      var doneFunction = options.doneFunction;
      var nyanBar = null;
      if (options.pattern) {
        if (typeof options.pattern == "string") {
          try {
            nyanBar = parseNyanBar(options.pattern);
          } catch (e) {
            console.log("Error parsing Nyan Bar: '" + options.pattern + "'");
          }
        } else {
          nyanBar = options.pattern;
        }
      } else if (options.patterns) {
        nyanBar = new MultiSegment(options);
      } else {
        nyanBar = parseNyanBar();
      }
      var rootBar = nyanBar.clone();
      var indeterminate = null;
      if (options.indeterminate) {
        if (typeof options.indeterminate == "string") {
          indeterminate = parseNyanBar(options.indeterminate);
        } else {
          indeterminate = options.indeterminate;
        }
      } else {
        indeterminate = parseNyanBar("{0|_|o| }*");
      }

      // Fills the div with a display of the nyan bar or the indeterminate bar.
      var displayFunc = function(percentComplete) {
        var strs = nyanBar.getSequenceString().split(/\n/);
        if (percentComplete < 0) {
          // Need to show the indeterminate bar.
          var indet = indeterminate.getSequenceString().split(/\n/);
          for (var i = 0; i < indet.length; ++i) {
            var str = indet[i];
            if (str.length > charSize) {
              indet[i] = str.substr(0, charSize);
            }
          }
          // Figure out how many lines are needed from the regular bar.
          while (indet.length < strs.length) {
            indet.push(indet[indet.length - 1]);
          }
          strs = indet;
        }
        // Make sure all stay within the length bounds.
        for (var i = 0; i < strs.length; ++i) {
          var str = strs[i];
          if (str.length > charSize) {
            strs[i] = str.substr(0, charSize);
          }
        }
        if (bookends) {
          for (var i = 0; i < strs.length; ++i) {
            var str = strs[i];
            while (str.length < charSize) {
              str += " ";
            }
            str = bookends + str + bookends;
            strs[i] = str;
          }
        }
        if (showProgress && percentComplete >= 0) {
          var ix = Math.floor(strs.length / 2);
          strs[ix] += " " + Math.round(percentComplete) + "%";
        }
        $(div).html(strs.join("<br>").replace(/ /g, "&nbsp;"));
      };
      var lastProgress = 0;
      var minLength = nyanBar.getFullLength(0);
      var deltaLength = nyanBar.getFullLength(1) - minLength;
      charSize -= charSize % deltaLength;

      // Advance the indeterminate bar to fill up the size.
      while (indeterminate.getFullLength() < charSize) {
        indeterminate.update(1);
      }

      var interval = setInterval(function() {
        var percentComplete = progressFunction();
        if (percentComplete >= 0) {
          if (percentComplete < lastProgress) {
            // Have to start over with a root.
            nyanBar = rootBar.clone();
          }
          // Make sure the Nyan bar is up-to-date.
          var desLength = (charSize - minLength) * percentComplete / 100.0 + minLength;
          var numSteps = 0;
          for (; nyanBar.getFullLength(numSteps + 1) <= desLength; ++numSteps) {
          }
          nyanBar.update(numSteps);
          lastProgress = percentComplete;
        } else {
          // Draw the indeterminate bar.
          indeterminate.update();
        }
        displayFunc(percentComplete);
        if (percentComplete == 100 && doneFunction && doneFunction() === true) {
          closeInterval(interval);
          return;
        }
      }, updatePeriod);
    });
  };
})(jQuery);