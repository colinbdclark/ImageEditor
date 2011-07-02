/*
Copyright 2011 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

// Declare dependencies
/*global window, fluid_1_4:true, jQuery*/

// JSLint options
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, nomen: true, regexp: true, bitwise: true, browser: true, forin: true, maxerr: 100, indent: 4 */

var fluid_1_4 = fluid_1_4 || {};

/****************
 * Image Editor *
 ****************/

(function ($, fluid) {

	//we'll add some private methods here

	var enableElement = function (that, elm) {
		elm.prop("disabled", false);
		elm.removeClass(that.options.styles.dim);
	};
	var disableElement = function (that, elm) {
		elm.prop("disabled", true);
		elm.addClass(that.options.styles.dim);
	};
	var showElement = function (that, elm) {
		elm.removeClass(that.options.styles.hidden);
	};
	var hideElement = function (that, elm) {
		elm.addClass(that.options.styles.hidden);
	};
	
	var TYPE_RESIZE = 1;
	var TYPE_CROP = 2;

	var clearCanvas = function (that) {
		var imageCanvas = that.imageCanvas.get()[0];
		var imageCanvasContext = imageCanvas.getContext('2d');	// Obtain the context
		var h = imageCanvas.height;
		var w = imageCanvas.width;
		imageCanvasContext.clearRect(0, 0, w, h);
	};

	var drawImage = function (that) {
		var imageCanvas = that.imageCanvas.get()[0];
		var imageCanvasContext = imageCanvas.getContext('2d');	// Obtain the context

		// Maintain aspect ratio while resizing larger image to smaller canvas.
		if (that.image.height > that.options.originalCanvasHeight || that.image.width > that.options.originalCanvasWidth) {
			var heightRatio = that.image.height / that.options.originalCanvasHeight;
			var widthRatio = that.image.width / that.options.originalCanvasHeight;
			that.resizeFactor = (heightRatio < widthRatio) ? widthRatio : heightRatio;
		} else {
			that.resizeFactor = 1;
		}

		imageCanvas.height = that.image.height / that.resizeFactor;
		imageCanvas.width = that.image.width / that.resizeFactor;

		that.imageX = 0;
		that.imageY = 0;

		imageCanvasContext.drawImage(that.image, that.imageX, that.imageY, that.image.width / that.resizeFactor, that.image.height / that.resizeFactor); // Draw image on canvas

	};
	
	var resize = function (that, resizeW, resizeH) {

		//Create canvas to get cropped image pixels
		var imageManipulationCanvas = document.createElement('canvas');
		imageManipulationCanvas.width = resizeW;
		imageManipulationCanvas.height = resizeH;

		var imageManipulationCtx = imageManipulationCanvas.getContext('2d');
		imageManipulationCtx.drawImage(that.image, 0, 0, resizeW, resizeH); // Draw resized image on temporary canvas
		var resizedImageDataURL = imageManipulationCanvas.toDataURL();	//get DataURL for cropped image
		return resizedImageDataURL;
	};
	
	var hideAllOptions = function (that) {
		hideElement(that, that.locate("cropOptions"));
		hideElement(that, that.locate("resizeOptions"));
		hideElement(that, that.locate("tagOptions"));
		if (that.cropStarted) {
			that.cropper.reset(true);	//reset crop without actually cropping the image.
		}
		that.cropStarted = false;
		that.resizeStarted = false;
		that.tagStarted = false;
	};
	
	var setupCrop = function (that) {
		if (!that.cropStarted) {
			hideAllOptions(that);
			showElement(that, that.locate("cropOptions"));
			that.cropStarted = true;
			that.cropper.init(that.imageCanvas.get()[0], that.resizeFactor, that.image, that.imageX, that.imageY);
		} else {
			hideAllOptions(that);
			that.cropStarted = false;
		}
	};
	
	var confirmCrop = function (that) {
		hideElement(that, that.locate("cropOptions"));
		that.cropStarted = false;
		var croppingReturnValues = that.cropper.reset();
		var croppedImageDataURL = croppingReturnValues[0];
		that.croppingDimensions = croppingReturnValues[1];
		that.setImage(croppedImageDataURL, TYPE_CROP);
	};

	var setupResize = function (that) {
		if (!that.resizeStarted) {
			hideAllOptions(that);
			showElement(that, that.locate("resizeOptions"));
			that.locate("resizeWidth").get(0).textContent = that.getImageWidth();
			that.locate("resizeHeight").get(0).textContent = that.getImageHeight();
			that.locate("resizeScale").get(0).textContent = '100%';
			that.resizeStarted = true;
		} else {
			hideAllOptions(that);
			that.resizeStarted = false;
		}
	};
	
	var confirmResize = function (that) {
		that.resizeStarted = false;
		hideElement(that, that.locate("resizeOptions"));
		var resizedImageDataURL, newH, newW;
		newW = parseFloat(that.locate("resizeWidth").get(0).textContent);
		newH = parseFloat(that.locate("resizeHeight").get(0).textContent);
		resizedImageDataURL = resize(that, newW, newH);
		that.setImage(resizedImageDataURL, TYPE_RESIZE);
	};
		
	var setupTag = function (that) {
		if (that.tagStarted) {
			//Done tagging
			that.tagButton.text(that.options.buttons.tag);
			that.tagStarted = false;
			enableElement(that, that.cropButton);
			enableElement(that, that.resizeButton);
			that.tagger.doneTagging();
			clearCanvas(that);
			drawImage(that);

			annotationNbUpdater(that, that.tagger.getNbAnnotations(), 0);
		} else {
			//Initialize and start tagging
			hideElement(that, that.locate("showAnnotation"));
			that.tagButton.text(that.options.buttons.doneTagging);
			disableElement(that, that.resizeButton);
			disableElement(that, that.cropButton);
			that.tagStarted = true;
			that.tagger.init(that.imageCanvas, that.resizeFactor, that.image, that.imageX, that.imageY);
		}
	};
		
	var showAnnotations = function (that) {
		that.tagger.showAnnotations();
		that.annotationsShown = true;
		that.locate("showAnnotationsLink").text("(hide)");
	};
	
	var hideAnnotations = function (that) {
		that.tagger.hideAnnotations();
		that.annotationsShown = false;
		that.locate("showAnnotationsLink").text("(show)");
	};
	
	annotationNbUpdater = function (that, nbAnnotations, oldNbAnnotations) {

		if (!that.tagStarted && nbAnnotations !== 0) {
			showElement(that, that.locate("showAnnotation"));
			var showAnnotationLink = ' <a href="" class="' + that.options.strings.showAnnotationsLink + '">(' + ((that.annotationsShown) ? 'hide' : 'show') + ')</a>';
			if (nbAnnotations === 1) {
				that.locate("showAnnotation").html(that.options.strings.showAnnotation + showAnnotationLink);
			} else {
				that.locate("showAnnotation").html(that.options.strings.showAnnotations.replace("%s", nbAnnotations) + showAnnotationLink);
			}
			that.locate("showAnnotationsLink").bind("click", function () {
				if (that.annotationsShown) {
					hideAnnotations(that);
				} else {
					showAnnotations(that);
				}
				return false;
			});
		} else {
			that.annotationsShown = false;
			hideElement(that, that.locate("showAnnotation"));
		}
	};
		
	var bindDOMEvents = function (that) {

		that.locate("cropButton").click(function () {
			setupCrop(that);
		});
		that.locate("tagButton").click(function () {
			setupTag(that);
		});
		that.locate("resizeButton").click(function () {
			setupResize(that);
		});
		
		that.locate("cropConfirm").click(function () {
			confirmCrop(that);
		});
		
		that.locate("resizeConfirm").click(function () {
			confirmResize(that);
		});
	};
	
	var updateResizeWidth = function (that, newWidth, oldWidth, isFixedRatio) {
		var oldResizeHeight = parseFloat(that.locate("resizeHeight").get(0).textContent); 
		if (isFixedRatio) {
			that.locate("resizeHeight").get(0).textContent = Math.round(newWidth / oldWidth * oldResizeHeight);
			that.locate("resizeScale").get(0).textContent = Math.round(newWidth / that.getImageWidth() * 100) + "%";
		}
	};
	
	var updateResizeHeight = function (that, newHeight, oldHeight, isFixedRatio) {
		var oldResizeWidth = parseFloat(that.locate("resizeWidth").get(0).textContent); 
		if (isFixedRatio) {
			that.locate("resizeWidth").get(0).textContent = Math.round(newHeight / oldHeight * oldResizeWidth);
			that.locate("resizeScale").get(0).textContent = Math.round(newHeight / that.getImageHeight() * 100) + "%";
		}
	};
	
	var cancelInlineEdits = function (that) {
		for (var i = 0; i < that.options.menuInlineEdits.length; ++i) {
			that.options.menuInlineEdits[i].cancel();
		}
	};
	
	var manageInlineEdits = function (that, newValue, oldValue, editNode, viewNode) {
		// Cancel the edit if new value not defined
		if (newValue === "") {
			cancelInlineEdits(that);
			return;
		} 
		
		if (that.locate("cropLocation").get(0) === viewNode) {
			var newLocation = newValue.split(',', 2);
			if (newLocation.length === 2) {
				that.cropper.setLocationX(parseFloat(newLocation[0]));
				that.cropper.setLocationY(parseFloat(newLocation[1]));
			}
		} else if (that.locate("cropWidth").get(0) === viewNode) {
			that.cropper.setWidth(parseFloat(newValue), that.locate("cropFixedRatioOn").get(0).checked);
		} else if (that.locate("cropHeight").get(0) === viewNode) {
			that.cropper.setHeight(parseFloat(newValue), that.locate("cropFixedRatioOn").get(0).checked);
		} else if (that.locate("resizeWidth").get(0) === viewNode) {
			updateResizeWidth(that, parseFloat(newValue), parseFloat(viewNode.textContent), true);
		} else if (that.locate("resizeHeight").get(0) === viewNode) {
			updateResizeHeight(that, parseFloat(newValue), parseFloat(viewNode.textContent), true);
		} else if (that.locate("resizeScale").get(0) === viewNode) {
			newValue = newValue.substring(0, (newValue.indexOf("%") === -1) ? newValue.length : newValue.indexOf("%"));
			that.locate("resizeWidth").get(0).textContent = newValue / 100 * that.getImageWidth();
			that.locate("resizeHeight").get(0).textContent = newValue / 100 * that.getImageHeight();
		}
	};
	
	var updateCropHeight = function (that, newHeight) {
		that.locate("cropHeight").get(0).textContent = Math.round(newHeight);
	};
	
	var updateCropWidth = function (that, newWidth) {
		that.locate("cropWidth").get(0).textContent = Math.round(newWidth);
	};
	
	var cropLocationX = 0;
	var cropLocationY = 0;
	
	var updateCropLocationX = function (that, newLocationX) {
		cropLocationX = newLocationX;
		that.locate("cropLocation").get(0).textContent = Math.round(cropLocationX) + ", " + Math.round(cropLocationY);
	};
	
	var updateCropLocationY = function (that, newLocationY) {
		cropLocationY = newLocationY;
		that.locate("cropLocation").get(0).textContent = Math.round(cropLocationX) + ", " + Math.round(cropLocationY);
	};
	
	var setupImageEditor = function (that) {

		that.imageCanvas = that.locate("imageCanvas");
		that.menuBar = that.locate("menuBar");
		that.resizeButton = that.locate("resizeButton");
		that.cropButton = that.locate("cropButton");
		that.tagButton = that.locate("tagButton");
		that.widthSpinner = that.locate("widthSpinner");
		that.heightSpinner = that.locate("heightSpinner");
		that.percSpinner = that.locate("percSpinner");
		
		that.cropStarted = false;
		that.tagStarted = false;
		that.resizeStarted = false;
		that.cropper = fluid.cropperUI(that.container);
		that.tagger = fluid.taggerUI(that.container, {
			//annotationNbUpdater: that.annotationNbUpdater
		});

		hideElement(that, that.locate("cropOptions"));
		hideElement(that, that.locate("resizeOptions"));
		hideElement(that, that.locate("tagOptions"));

		bindDOMEvents(that);
		
		var manageAllInlineEdits = function (newValue, oldValue, editNode, viewNode) {
			manageInlineEdits(that, newValue, oldValue, editNode, viewNode);
		};
		
		for (var i = 0; i < that.options.menuInlineEdits.length; ++i) {
			var menuInlineEdit = that.options.menuInlineEdits[i];
			menuInlineEdit.events.onFinishEdit.addListener(manageAllInlineEdits);
		}
		
		that.cropper.events.onChangeHeight.addListener(function (newHeight) {
			updateCropHeight(that, newHeight);
		});
		
		that.cropper.events.onChangeWidth.addListener(function (newWidth) {
			updateCropWidth(that, newWidth);
		});
		
		that.cropper.events.onChangeLocationX.addListener(function (newLocationX) {
			updateCropLocationX(that, newLocationX);
		});
		
		that.cropper.events.onChangeLocationY.addListener(function (newLocationY) {
			updateCropLocationY(that, newLocationY);
		});
		
		that.tagger.events.onAnnotationNbChange.addListener(function (newNbAnnotations, oldNbAnnotations) {
			annotationNbUpdater(that, newNbAnnotations, oldNbAnnotations);
		});
			
		if (that.options.demo && that.options.demoImageURL) {
			that.setImage(that.options.demoImageURL);
		}
		// Uploader uses application-style keyboard conventions, so give it a suitable role.
		//that.container.attr("role", "application");
	};

	/**
	 * Instantiates a new Image Editor component.
	 *
	 * @param {Object} container the DOM element in which the Image Editor lives
	 * @param {Object} options configuration options for the component.
	 */
	fluid.imageEditor = function (container, options) {
		var that = fluid.initView("fluid.imageEditor", container, options);

		that.setImage = function (imageURL, isResizedORCropped) {

			if (!isResizedORCropped) {
				that.tagger.reset();
			}

			clearCanvas(that);
			that.image = new Image();		// Create a new img element

			that.image.onload = function () {

				drawImage(that);

				if (isResizedORCropped === TYPE_RESIZE) {
					that.tagger.adjustTagsForResize(that.imageCanvas.width(), that.imageCanvas.height(), that.resizeFactor, that.image, that.imageX, that.imageY);
				} else if (isResizedORCropped === TYPE_CROP) {
					that.tagger.adjustTagsForCrop(that.imageCanvas.width(), that.imageCanvas.height(), that.resizeFactor, that.image, that.imageX, that.imageY, that.croppingDimensions);
				}

				enableElement(that, that.cropButton);
				enableElement(that, that.resizeButton);
			};
			
			that.image.src = imageURL;			// Set the source path
		};
		
		that.getImageWidth = function () {
			return that.image.width;
		};
		
		that.getImageHeight = function () {
			return that.image.height;
		};
		
		setupImageEditor(that);

		//that.displayElement.hide();

		return that;
	};
	fluid.defaults("fluid.imageEditor", {
		gradeNames: "fluid.viewComponent",
		selectors: {
			imageCanvas: ".flc-image-canvas", // required, the canvas element that shows the image
			menuBar: ".flc-menu-bar", //required, provides different functions
			resizeButton: ".flc-image-editor-button-resize", //required, Resize Button
			cropButton: ".flc-image-editor-button-crop", //required, Crop Button
			tagButton: ".flc-image-editor-button-tag", //required, Tag Button
			cropOptions: ".fl-image-editor-crop-options", //required, Crop Options
			resizeOptions: ".fl-image-editor-resize-options", //required, Resize Options
			tagOptions: ".fl-image-editor-tag-options", //required, Tag Options
			cropConfirm: ".fl-image-editor-button-crop-confirm", //required, Crop Confirm Button
			resizeConfirm: ".fl-image-editor-button-resize-confirm", //required, Resize Confirm Button
			tagConfirm: ".fl-image-editor-button-tag-confirm", //required, Tag Confirm Button
			cropLocation: ".fl-image-editor-crop-location", //Crop Location
			cropWidth: ".fl-image-editor-crop-width", //Crop Width
			cropHeight: ".fl-image-editor-crop-height", //Crop Height
			cropFixedRatioOn: ".fl-image-editor-crop-radio-fixed-ratio-on",
			cropFixedRatioOff: ".fl-image-editor-crop-radio-fixed-ratio-off",
			resizeScale: ".fl-image-editor-resize-scale", //Resize Location
			resizeWidth: ".fl-image-editor-resize-width", //Resize Width
			resizeHeight: ".fl-image-editor-resize-height", //Resize Height
			showAnnotation: ".fl-image-editor-show-annotation",
			showAnnotationsLink: ".flc-image-editor-show-annotations-link"
		},

		styles: {
			disabled: "fl-image-editor-disabled",
			hidden: "fl-image-editor-hidden",
			dim: "fl-image-editor-dim",
			border: "fl-image-editor-border"
		},

		buttons: {
			doneTagging: "Done Tagging",
			tag: "Tag"
		},

		//TODO: Change as needed
		strings: {
			showAnnotation: "The image has 1 annotation",
			showAnnotations: "The image has %s annotations",
			showAnnotationsLink: "flc-image-editor-show-annotations-link",
			//Empty value for ariaBusyText will default to aria-valuenow.
			ariaBusyText: "Progress is %percentComplete percent complete",
			ariaDoneText: "Progress is complete."
		},

		demo: false,
		originalCanvasHeight: 750,
		originalCanvasWidth: 750
	});
	//we'll put our default options here

})(jQuery, fluid_1_4);