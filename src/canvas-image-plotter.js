var CanvasImagePlotter = (function () {
	/** A ClipAdjustment provides state information and the ability to adjust state information for an *image* clip.
      * It assumes that the clip is a rectangle. Placement on a plane / within a viewport is tracked based on the 
      * top, left corner of the rectangular clip. Zoom adjustments are tracked based on the length of the diaganol between the 
      * top, left vertex (corner) and the bottom, right vertex (corner).
      * 
      * You can move a ClipAdjustment around on a coordinate plane or zoom in and out on the clip relative to the plane.
      * All adjustments made to a clip are assumed to be relative to a viewport on a coordinate plane.
	  */
	var ClipAdjustment = function (left_, top_, width_, height_) {
		this._x = left_,
		this._y = top_,
		/** The diagonal of the clip, which is the hypotenuse of 2 similar triangles. Calculated using the Pythagorean theorem. */
		this._hyp = Math.sqrt(Math.pow(parseInt(width_),2) + Math.pow(parseInt(height_),2)),
		this._sin = parseInt(width_) / this._hyp,
		this._cos = parseInt(height_) / this._hyp,
		
		/** Zoom out or in on the Clip relative to a viewport on a plane
		  * @param {number} amount_ is the amount to zoom in or out, but more specifically the distance to change the diagonal. 
		  *                Can be positive or negative depending on if you're zooming in or out. */
		this.zoom = function(amount_) {
			// change the length of the diagonal / hypotenuse according to amount of zoom
			this._hyp += amount_;
			// adjust the top, left point to center the zoom
			// 1. get 1/2 amount of change to hypotenuse (This will zoom using the center of the image as the reference point)
			var hyp_diff = amount_ * .5;
			// 2. we have a new hypotenuse sin and cos still apply
			// by extending the hypotenuse, we essentially get a new triangle with the same sin and cos (just flipped)
			// so we can use the sin and cosine to calculate the distance change (which is really 2 sides of a right triangle)
			this._y -= hyp_diff * this._cos;
			this._x -= hyp_diff * this._sin;
		},

		/** Move the clip around on a plane.
		  * @param {number} x_offset_ amount of change on the x axis.
		  * @param {number} y_offset_ amount of change on the y axis.
		  */
		this.move = function(x_offset_, y_offset_) {
			this._x += x_offset_;
			this._y += y_offset_;
		}
		this.getX = function() {
			return this._x;
		},
		this.getY = function() {
			return this._y;
		},
		this.getWidth = function() {
			return this._sin * this._hyp;
		},
		this.getHeight = function() {
			return this._cos * this._hyp;
		},
		/** Calculates the change in diagonal / hypotenuse given a new width of the clip. Non-destructive. 
		  * Just calculates. Doesn't make any changes.
		  * @param {number} new_width_ the width to use for the calculation.
		  */
		this.calcHypDifferenceByWidth = function (new_width_) {
			return this._hyp - (new_width_ / this._sin);
		}
		/** Calculates the change in diagonal / hypotenuse given a new height of the clip. Non-destructive. 
		  * Just calculates. Doesn't make any changes.
		  * @param {number} new_height_ the height to use for the calculation.
		  */
		this.calcHypDifferenceByHeight = function (new_height_) {
			return this._hyp - (new_height_ / this._cos);
		}

		/** Get the current state of the clip including it's 2D offset on a plane and relative size based on zoom amount */
		this.getState = function() {
			return new Clip(this.getX(), this.getY(), this.getWidth(), this.getHeight());
		}

		/** for easier logging and debugging */
		this.dump = function() {
			return {
				x: this._x,
				y: this._y,
				hyp: this._hyp,
				sin: this._sin,
				cos: this._cos,
				width: this.getWidth(),
				height: this.getHeight()
			};
		}
	};

	/** A stationary and static clip... assumed to be a rectangle.
	  * @param {number} left_ = point on the x axis of the top, left corner of the clip
	  * @param {number} top_ = point on the y axis of the top, left corner of the clip
	  * @param {number} width_ = width of the clip
	  * @param {number} height_ = height of the clip
	  */
	var Clip = function (left_, top_, width_, height_) {
			this.left = left_,
			this.top = top_,
			this.width = width_,
			this.height = height_,
			this.width_to_height_ratio = function() {
				return this.width / this.height;
			},
			this.height_to_width_ratio = function() {
				return this.height / this.width;
			},
			this.is_square = function() {
				return (this.width == this.height);
			},
			this.is_horizontal = function() {
				return (this.width > this.height);
			},
			this.is_vertical = function() {
				return (this.width < this.height);
			}
		};

	var ImagePlot = function() {
		this.image = new Clip(),
		this.canvas = new Clip()
	};

	/** ImagePlotter is a utility that helps plot and graph images on an HTML5 canvas. It does the math so you don't have to.
	  * It will give you image and canvas relative coordinates / width / height that you can 
	  * use as arguments to canvas.getContext().drawImage()
	  * @param opts_ options
	                 opts_.orientation initial orientation of the image clip relative to a plane / canvas.
	                 accepted values are:
	                 "contain" - fits entire image clip inside viewport / canvas. 
	                 "cover" - zooms out or in on the image to the extent needed to conver the entire viewport with the image clip.
	  */
	var ImagePlotter = function (image_width_, image_height_, canvas_width_, canvas_height_, opts_ = {}) {

		/** Sets intensity of zoom. (how fast or slow to zoom). 1 will be slower than 10, for example. */
		this.zoom_multiplier = 1;
	
		// Private properties. Probably better if you don't mess with them.
		this._state = new ClipAdjustment(0,0,0,0);
		
		this._image  =  new Clip(0,0,0,0);

		this._canvas = new Clip(0,0,0,0);
	
		// initialize
		this.init(image_width_, image_height_, canvas_width_, canvas_height_, {orientation: opts_.orientation || "cover"});

	};

	/**
	  * Initialize a new image clip in the viewport. 
	  */
	ImagePlotter.prototype.init = function(image_width_, image_height_, canvas_width_, canvas_height_, opts_ = {}) {
		this._image.width =  image_width_;
		this._image.height =  image_height_;
		this._canvas.width =  canvas_width_;
		this._canvas.height =  canvas_height_;

		this._state = new ClipAdjustment(0,0,image_width_,image_height_);

		// determine initial clip
		switch(opts_.orientation) {
			case 'contain': return this.contain();
			default: return this.cover();
		}

	};

	/** Orient the image clip in the viewport / canvas. Don't change the size of the image, but center it in the viewport */
	ImagePlotter.prototype.centerFullSize = function() {
		var plot = new ImagePlot();
		plot.image = new Clip(0,0,this._image.width, this._image.height);
		// find the width and height difference
		var width_diff = this._image.width - this._canvas.width;
		var height_diff = this._image.height - this._canvas.height;
		this._state.move(-width_diff * .5, -height_diff *.5);
		plot.canvas = this._state.getState();
		return plot;
	}

	/** Orient the image clip in the viewport / canvas. 
	  *	Zooms out or in on the image to the extent needed to cover the entire viewport with the image clip. 
	  */
	ImagePlotter.prototype.cover = function() {
		result = this.centerFullSize();
		var plot = new ImagePlot();
		plot.image = new Clip(0,0,this._image.width, this._image.height);

		if (Math.min(this._image.width, this._image.height) == this._image.width) {
			var hyp_diff = this._state.calcHypDifferenceByWidth(this._canvas.width);
			this._state.zoom(-hyp_diff);
		} else {
			var hyp_diff = this._state.calcHypDifferenceByHeight(this._canvas.height);
			this._state.zoom(-hyp_diff);
		}

		plot.canvas = this._state.getState();
		return plot;
	}

	/** Orient the image clip in the viewport / canvas. 
	  *	Fits entire image clip inside viewport / canvas.
	  */
	ImagePlotter.prototype.contain = function() {
		this.centerFullSize();
		var plot = new ImagePlot();
		plot.image = new Clip(0,0,this._image.width, this._image.height);

		if (Math.max(this._image.width, this._image.height) == this._image.width) {
			var hyp_diff = this._state.calcHypDifferenceByWidth(this._canvas.width);
			this._state.zoom(-hyp_diff);
		} else {
			var hyp_diff = this._state.calcHypDifferenceByHeight(this._canvas.height);
			this._state.zoom(-hyp_diff);
		}

		plot.canvas = this._state.getState();
		return plot;
	};

	ImagePlotter.prototype.move = function(x_move_, y_move_) {
		var plot = new ImagePlot();
		plot.image = new Clip(0,0,this._image.width, this._image.height);
		this._state.move(x_move_,y_move_);
		plot.canvas = this._state.getState();
		return plot;
	}

	
	/** @param opts_.zoom_depth positive number means zoom in. negative number means zoom out.
	  */
	ImagePlotter.prototype.zoom = function(opts_) {
		var mult = opts_.zoom_multiplier || this.zoom_multiplier;
		var depth = parseInt(opts_.zoom_depth) || 0;

		var plot = new ImagePlot();
		plot.image = new Clip(0,0,this._image.width, this._image.height);
		this._state.zoom(mult * depth);
		plot.canvas = this._state.getState();

		return plot;

	}

	return ImagePlotter;

})();

module.exports = CanvasImagePlotter;
	
