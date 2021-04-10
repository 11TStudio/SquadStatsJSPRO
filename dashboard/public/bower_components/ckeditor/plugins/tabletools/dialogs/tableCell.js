﻿/*
 Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
*/
CKEDITOR.dialog.add("cellProperties", function (f) {
	function d(a) {
		return function (b) {
			for (var c = a(b[0]), d = 1; d < b.length; d++)
				if (a(b[d]) !== c) {
					c = null;
					break;
				}
			"undefined" != typeof c &&
				(this.setValue(c),
				CKEDITOR.env.gecko &&
					"select" == this.type &&
					!c &&
					(this.getInputElement().$.selectedIndex = -1));
		};
	}
	function l(a) {
		if ((a = n.exec(a.getStyle("width") || a.getAttribute("width"))))
			return a[2];
	}
	var h = f.lang.table,
		c = h.cell,
		e = f.lang.common,
		k = CKEDITOR.dialog.validate,
		n = /^(\d+(?:\.\d+)?)(px|%)$/,
		g = { type: "html", html: "\x26nbsp;" },
		p = "rtl" == f.lang.dir,
		m = f.plugins.colordialog;
	return {
		title: c.title,
		minWidth: CKEDITOR.env.ie && CKEDITOR.env.quirks ? 450 : 410,
		minHeight:
			CKEDITOR.env.ie && (CKEDITOR.env.ie7Compat || CKEDITOR.env.quirks)
				? 230
				: 220,
		contents: [
			{
				id: "info",
				label: c.title,
				accessKey: "I",
				elements: [
					{
						type: "hbox",
						widths: ["40%", "5%", "40%"],
						children: [
							{
								type: "vbox",
								padding: 0,
								children: [
									{
										type: "hbox",
										widths: ["70%", "30%"],
										children: [
											{
												type: "text",
												id: "width",
												width: "100px",
												requiredContent: "td{width,height}",
												label: e.width,
												validate: k.number(c.invalidWidth),
												onLoad: function () {
													var a = this.getDialog()
															.getContentElement("info", "widthType")
															.getElement(),
														b = this.getInputElement(),
														c = b.getAttribute("aria-labelledby");
													b.setAttribute(
														"aria-labelledby",
														[c, a.$.id].join(" ")
													);
												},
												setup: d(function (a) {
													var b = parseInt(a.getAttribute("width"), 10);
													a = parseInt(a.getStyle("width"), 10);
													return isNaN(a) ? (isNaN(b) ? "" : b) : a;
												}),
												commit: function (a) {
													var b = parseInt(this.getValue(), 10),
														c =
															this.getDialog().getValueOf(
																"info",
																"widthType"
															) || l(a);
													isNaN(b)
														? a.removeStyle("width")
														: a.setStyle("width", b + c);
													a.removeAttribute("width");
												},
												default: "",
											},
											{
												type: "select",
												id: "widthType",
												requiredContent: "td{width,height}",
												label: f.lang.table.widthUnit,
												labelStyle: "visibility:hidden",
												default: "px",
												items: [
													[h.widthPx, "px"],
													[h.widthPc, "%"],
												],
												setup: d(l),
											},
										],
									},
									{
										type: "hbox",
										widths: ["70%", "30%"],
										children: [
											{
												type: "text",
												id: "height",
												requiredContent: "td{width,height}",
												label: e.height,
												width: "100px",
												default: "",
												validate: k.number(c.invalidHeight),
												onLoad: function () {
													var a = this.getDialog()
															.getContentElement("info", "htmlHeightType")
															.getElement(),
														b = this.getInputElement(),
														c = b.getAttribute("aria-labelledby");
													this.getDialog()
														.getContentElement("info", "height")
														.isVisible() &&
														(a.setHtml("\x3cbr /\x3e" + h.widthPx),
														a.setStyle("display", "block"),
														this.getDialog()
															.getContentElement("info", "hiddenSpacer")
															.getElement()
															.setStyle("display", "block"));
													b.setAttribute(
														"aria-labelledby",
														[c, a.$.id].join(" ")
													);
												},
												setup: d(function (a) {
													var b = parseInt(a.getAttribute("height"), 10);
													a = parseInt(a.getStyle("height"), 10);
													return isNaN(a) ? (isNaN(b) ? "" : b) : a;
												}),
												commit: function (a) {
													var b = parseInt(this.getValue(), 10);
													isNaN(b)
														? a.removeStyle("height")
														: a.setStyle("height", CKEDITOR.tools.cssLength(b));
													a.removeAttribute("height");
												},
											},
											{
												id: "htmlHeightType",
												type: "html",
												html: "",
												style: "display: none",
											},
										],
									},
									{
										type: "html",
										id: "hiddenSpacer",
										html: "\x26nbsp;",
										style: "display: none",
									},
									{
										type: "select",
										id: "wordWrap",
										label: c.wordWrap,
										default: "yes",
										items: [
											[c.yes, "yes"],
											[c.no, "no"],
										],
										setup: d(function (a) {
											var b = a.getAttribute("noWrap");
											if ("nowrap" == a.getStyle("white-space") || b)
												return "no";
										}),
										commit: function (a) {
											"no" == this.getValue()
												? a.setStyle("white-space", "nowrap")
												: a.removeStyle("white-space");
											a.removeAttribute("noWrap");
										},
									},
									g,
									{
										type: "select",
										id: "hAlign",
										label: c.hAlign,
										default: "",
										items: [
											[e.notSet, ""],
											[e.left, "left"],
											[e.center, "center"],
											[e.right, "right"],
											[e.justify, "justify"],
										],
										setup: d(function (a) {
											var b = a.getAttribute("align");
											return a.getStyle("text-align") || b || "";
										}),
										commit: function (a) {
											var b = this.getValue();
											b
												? a.setStyle("text-align", b)
												: a.removeStyle("text-align");
											a.removeAttribute("align");
										},
									},
									{
										type: "select",
										id: "vAlign",
										label: c.vAlign,
										default: "",
										items: [
											[e.notSet, ""],
											[e.alignTop, "top"],
											[e.alignMiddle, "middle"],
											[e.alignBottom, "bottom"],
											[c.alignBaseline, "baseline"],
										],
										setup: d(function (a) {
											var b = a.getAttribute("vAlign");
											a = a.getStyle("vertical-align");
											switch (a) {
												case "top":
												case "middle":
												case "bottom":
												case "baseline":
													break;
												default:
													a = "";
											}
											return a || b || "";
										}),
										commit: function (a) {
											var b = this.getValue();
											b
												? a.setStyle("vertical-align", b)
												: a.removeStyle("vertical-align");
											a.removeAttribute("vAlign");
										},
									},
								],
							},
							g,
							{
								type: "vbox",
								padding: 0,
								children: [
									{
										type: "select",
										id: "cellType",
										label: c.cellType,
										default: "td",
										items: [
											[c.data, "td"],
											[c.header, "th"],
										],
										setup: d(function (a) {
											return a.getName();
										}),
										commit: function (a) {
											a.renameNode(this.getValue());
										},
									},
									g,
									{
										type: "text",
										id: "rowSpan",
										label: c.rowSpan,
										default: "",
										validate: k.integer(c.invalidRowSpan),
										setup: d(function (a) {
											if (
												(a = parseInt(a.getAttribute("rowSpan"), 10)) &&
												1 != a
											)
												return a;
										}),
										commit: function (a) {
											var b = parseInt(this.getValue(), 10);
											b && 1 != b
												? a.setAttribute("rowSpan", this.getValue())
												: a.removeAttribute("rowSpan");
										},
									},
									{
										type: "text",
										id: "colSpan",
										label: c.colSpan,
										default: "",
										validate: k.integer(c.invalidColSpan),
										setup: d(function (a) {
											if (
												(a = parseInt(a.getAttribute("colSpan"), 10)) &&
												1 != a
											)
												return a;
										}),
										commit: function (a) {
											var b = parseInt(this.getValue(), 10);
											b && 1 != b
												? a.setAttribute("colSpan", this.getValue())
												: a.removeAttribute("colSpan");
										},
									},
									g,
									{
										type: "hbox",
										padding: 0,
										widths: ["60%", "40%"],
										children: [
											{
												type: "text",
												id: "bgColor",
												label: c.bgColor,
												default: "",
												setup: d(function (a) {
													var b = a.getAttribute("bgColor");
													return a.getStyle("background-color") || b;
												}),
												commit: function (a) {
													this.getValue()
														? a.setStyle("background-color", this.getValue())
														: a.removeStyle("background-color");
													a.removeAttribute("bgColor");
												},
											},
											m
												? {
														type: "button",
														id: "bgColorChoose",
														class: "colorChooser",
														label: c.chooseColor,
														onLoad: function () {
															this.getElement()
																.getParent()
																.setStyle("vertical-align", "bottom");
														},
														onClick: function () {
															f.getColorFromDialog(function (a) {
																a &&
																	this.getDialog()
																		.getContentElement("info", "bgColor")
																		.setValue(a);
																this.focus();
															}, this);
														},
												  }
												: g,
										],
									},
									g,
									{
										type: "hbox",
										padding: 0,
										widths: ["60%", "40%"],
										children: [
											{
												type: "text",
												id: "borderColor",
												label: c.borderColor,
												default: "",
												setup: d(function (a) {
													var b = a.getAttribute("borderColor");
													return a.getStyle("border-color") || b;
												}),
												commit: function (a) {
													this.getValue()
														? a.setStyle("border-color", this.getValue())
														: a.removeStyle("border-color");
													a.removeAttribute("borderColor");
												},
											},
											m
												? {
														type: "button",
														id: "borderColorChoose",
														class: "colorChooser",
														label: c.chooseColor,
														style:
															(p ? "margin-right" : "margin-left") + ": 10px",
														onLoad: function () {
															this.getElement()
																.getParent()
																.setStyle("vertical-align", "bottom");
														},
														onClick: function () {
															f.getColorFromDialog(function (a) {
																a &&
																	this.getDialog()
																		.getContentElement("info", "borderColor")
																		.setValue(a);
																this.focus();
															}, this);
														},
												  }
												: g,
										],
									},
								],
							},
						],
					},
				],
			},
		],
		onShow: function () {
			this.cells = CKEDITOR.plugins.tabletools.getSelectedCells(
				this._.editor.getSelection()
			);
			this.setupContent(this.cells);
		},
		onOk: function () {
			for (
				var a = this._.editor.getSelection(),
					b = a.createBookmarks(),
					c = this.cells,
					d = 0;
				d < c.length;
				d++
			)
				this.commitContent(c[d]);
			this._.editor.forceNextSelectionCheck();
			a.selectBookmarks(b);
			this._.editor.selectionChange();
		},
		onLoad: function () {
			var a = {};
			this.foreach(function (b) {
				b.setup &&
					b.commit &&
					((b.setup = CKEDITOR.tools.override(b.setup, function (c) {
						return function () {
							c.apply(this, arguments);
							a[b.id] = b.getValue();
						};
					})),
					(b.commit = CKEDITOR.tools.override(b.commit, function (c) {
						return function () {
							a[b.id] !== b.getValue() && c.apply(this, arguments);
						};
					})));
			});
		},
	};
});
