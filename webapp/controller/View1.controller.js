    sap.ui.define([
        "sap/ui/core/mvc/Controller",
        "sap/ui/core/Fragment",
        "sap/ui/export/Spreadsheet",
        "sap/ui/export/library",
        "sap/m/MessageToast",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/m/MessageBox",
        "sap/base/Log"
    ], function (Controller, Fragment, Spreadsheet, exportLibrary, MessageToast, Filter, FilterOperator, MessageBox, Log) {
        "use strict";
        var EdmType = exportLibrary.EdmType;
        return Controller.extend("zfgtrns.controller.View1", {

            onInit: function () {
                var oLocalModel = new sap.ui.model.json.JSONModel(this._createTransferFormData());
                this.getView().setModel(oLocalModel, "local");
                this.getOwnerComponent().attachAppSuspend(this._destroyStyleDialog, this);
            },

            _createTransferFormData: function () {
                var oToday = new Date();
                var sDay = String(oToday.getDate()).padStart(2, "0");
                var sMonth = String(oToday.getMonth() + 1).padStart(2, "0");
                return {
                    postingSuccessful: false,
                    header: {
                        selectionMode: "MANUAL",
                        postingDate: sDay + "." + sMonth + "." + oToday.getFullYear(),
                        fromPlant: "",
                        toPlant: "",
                        fromSloc: "",
                        toSloc: "",
                        remark: ""
                    },
                    selection: {
                        style: "",
                        brand: "",
                        category: "",
                        season: "",
                        subCategory: "",
                        manualBatch: "",
                        scannedBatch: ""
                    },
                    fromLocationItems: [],
                    fromTotalQty: 0,
                    fromItemCount: 0,
                    toLocationItems: [],
                    toTotalQty: 0
                };
            },

            onExit: function () {
                this.getOwnerComponent().detachAppSuspend(this._destroyStyleDialog, this);
                this._destroyStyleDialog();
            },

            onExportButtonPress: function () {
                var oView = this.getView();
                var oLocalModel = oView.getModel("local");
                var aItems = oLocalModel.getProperty("/fromLocationItems");

                if (!aItems || aItems.length === 0) {
                    MessageToast.show("There are no items to export.");
                    return;
                }

                var aExportData = aItems.map(function (oItem) {
                    return Object.assign({}, oItem);
                });

                var aCols = this._createColumnConfig();

                var oSettings = {
                    workbook: {
                        columns: aCols,
                        hierarchyLevel: 'Level'
                    },
                    dataSource: aExportData,
                    fileName: 'FG_Transfer_Items_' + new Date().toISOString().slice(0, 10) + '.xlsx',
                    worker: false
                };

                var oSheet = new Spreadsheet(oSettings);
                oSheet.build().finally(function () {
                    oSheet.destroy();
                });
            },

            _createColumnConfig: function () {
                var EdmType = exportLibrary.EdmType;

                return [
                    { label: 'Sales Order', property: 'salesOrder', type: EdmType.String },
                    { label: 'SO Line Item', property: 'soLineItem', type: EdmType.String },
                    { label: 'Style', property: 'style', type: EdmType.String },
                    { label: 'Material', property: 'material', type: EdmType.String },
                    { label: 'Color', property: 'color', type: EdmType.String },
                    { label: 'Size', property: 'size', type: EdmType.String },
                    { label: 'Lot No', property: 'lotNo', type: EdmType.String },
                    { label: 'Batch', property: 'batch', type: EdmType.String },
                    { label: 'Quantity', property: 'quantity', type: EdmType.Number, scale: 2 },
                    { label: 'UoM', property: 'uom', type: EdmType.String }
                ];
            },

            onSegmentedButtonSelectionChange: function (oEvent) {
                var sSelectedKey = oEvent.getParameter("key");
                var oLocalModel = this.getView().getModel("local");
                oLocalModel.setProperty("/header/selectionMode", sSelectedKey);
            },

            // ==========================================
            // PLANT VALUE HELP LOGIC
            // ==========================================

            onFromPlantInputSuggest: function (oEvent) {
                this.onPlantSuggest(oEvent);
            },
            onToPlantInputSuggest: function (oEvent) {
                this.onPlantSuggest(oEvent);
            },

           onPlantSuggest: function (oEvent) {
    var sTerm = oEvent.getParameter("suggestValue");
    var aFilters = [];

    if (sTerm) {
        aFilters.push(new Filter({
            filters: [
                new Filter("Plant", FilterOperator.StartsWith, sTerm),
                new Filter("PlantName", FilterOperator.Contains, sTerm)
            ],
            and: false
        }));
    }
    
    // Filter suggestion binding dynamically
    var oBinding = oEvent.getSource().getBinding("suggestionItems");
    if (oBinding) {
        oBinding.filter(aFilters);
    }
},

            onFromPlantInputValueHelpRequest: function () {
                this._sPlantTarget = "from";
                this._openPlantDialog();
            },

            onToPlantInputValueHelpRequest: function () {
                this._sPlantTarget = "to";
                this._openPlantDialog();
            },

            _openPlantDialog: function () {
                var oView = this.getView();

                if (!this._oPlantDialog) {
                    Fragment.load({
                        id: oView.getId() + "--PlantDialog",
                        name: "zfgtrns.view.PlantVH",
                        controller: this
                    }).then(function (oDialog) {
                        this._oPlantDialog = oDialog;
                        oView.addDependent(this._oPlantDialog);
                        this._oPlantDialog.open();
                    }.bind(this));
                } else {
                    this._oPlantDialog.open();
                }
            },

            onZiPlantvhSelectDialogSearch: function (oEvent) {
                var sValue = oEvent.getParameter("value");
                var aFilters = [];

                if (sValue) {
                    aFilters.push(new Filter({
                        filters: [
                            new Filter("Plant", FilterOperator.Contains, sValue),
                            new Filter("PlantName", FilterOperator.Contains, sValue)
                        ],
                        and: false
                    }));
                }
                oEvent.getSource().getBinding("items").filter(aFilters);
            },

            onZiPlantvhSelectDialogConfirm: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("selectedItem");
                if (oSelectedItem) {
                    var oContext = oSelectedItem.getBindingContext();
                    var sPlant = oContext ? oContext.getProperty("Plant") : null;

                    if (!sPlant) {
                        sPlant = oSelectedItem.getTitle() || (oSelectedItem.getCells && oSelectedItem.getCells()[0].getText());
                    }

                    var oLocalModel = this.getView().getModel("local");

                    if (this._sPlantTarget === "to") {
                        if (oLocalModel) {
                            oLocalModel.setProperty("/header/toPlant", sPlant);
                        }
                        var oToInput = this.byId("idToPlantInput");
                        if (oToInput) { oToInput.setValue(sPlant); }
                    } else {
                        if (oLocalModel) {
                            oLocalModel.setProperty("/header/fromPlant", sPlant);
                        }
                        var oFromInput = this.byId("idFromPlantInput") || this.byId("inputPlant");
                        if (oFromInput) { oFromInput.setValue(sPlant); }
                    }

                    if (typeof this.onSelectionChange === "function") {
                        this.onSelectionChange();
                    }
                }
            },

            // ==========================================
            // STORAGE LOCATION VALUE HELP LOGIC
            // ==========================================

        

            onFromSlocInputValueHelpRequest: function () {
                this._openSlocDialog("from");
            },

            onToSlocInputValueHelpRequest: function () {
                this._openSlocDialog("to");
            },

            _openSlocDialog: function (sTarget) {
                if (this._pSlocDialog) {
                    return;
                }

                var oView = this.getView();
                var oLocalModel = oView.getModel("local");
                var bFrom = sTarget === "from";
                var sPlant = this._getSlocPlant(oLocalModel, sTarget);
                if (!sPlant) {
                    MessageToast.show(bFrom ? "Please select From Plant first." : "Please select To Plant first.");
                    return;
                }

                this._sSlocTarget = sTarget;
                this._sSlocDialogPlant = sPlant;
                var fnOpen = function (oDialog) {
                    oDialog.setTitle(bFrom ? "Select From Storage Location" : "Select To Storage Location");
                    this._filterSlocBinding(oDialog.getBinding("items"), sPlant, "");
                    oDialog.open();
                }.bind(this);
                if (!this._oSlocDialog) {
                    this._pSlocDialog = this.loadFragment({
                        id: "SlocDialog",
                        name: "zfgtrns.view.FromSlocVH"
                    }).then(function (oDialog) {
                        this._pSlocDialog = null;
                        this._oSlocDialog = oDialog;
                        fnOpen(oDialog);
                    }.bind(this), function (oError) {
                        this._pSlocDialog = null;
                        Log.error("Could not load Storage Location value help", oError && oError.message, "zfgtrns.controller.View1");
                    }.bind(this));
                } else {
                    fnOpen(this._oSlocDialog);
                }
            },

            _getSlocPlant: function (oLocalModel, sTarget) {
                var sPlant = oLocalModel.getProperty("/header/" + sTarget + "Plant");
                if (!sPlant) {
                    var oInput = this.byId(sTarget === "from" ? "idFromPlantInput" : "idToPlantInput");
                    sPlant = oInput ? oInput.getValue() : "";
                }
                return sPlant.trim();
            },

            onFromSlocVHSearch: function (oEvent) {
                this._filterSlocBinding(oEvent.getSource().getBinding("items"),
                    this._sSlocDialogPlant, oEvent.getParameter("value"));
            },

            _filterSlocBinding: function (oBinding, sPlant, sValue) {
                if (!oBinding || !sPlant) {
                    return;
                }
                var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

                if (sValue) {
                    aFilters.push(new Filter({
                        filters: [
                            new Filter("StorageLocation", FilterOperator.Contains, sValue),
                            new Filter("StorageLocationName", FilterOperator.Contains, sValue)
                        ],
                        and: false
                    }));
                }

                oBinding.filter(new Filter({ filters: aFilters, and: true }));
                if (oBinding.isSuspended()) {
                    oBinding.resume();
                }
            },

            onFromSlocVHConfirm: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("selectedItem");
                if (oSelectedItem) {
                    var oContext = oSelectedItem.getBindingContext();
                    var sSloc = oContext ? oContext.getProperty("StorageLocation") : null;

                    if (!sSloc && oSelectedItem.getCells) {
                        sSloc = oSelectedItem.getCells()[1].getText();
                    }

                    var oLocalModel = this.getView().getModel("local");

                    if (this._sSlocTarget === "to") {
                        if (oLocalModel) {
                            oLocalModel.setProperty("/header/toSloc", sSloc);
                        }
                        var oToSlocInput = this.byId("idToSlocInput");
                        if (oToSlocInput) { oToSlocInput.setValue(sSloc); }
                    } else {
                        if (oLocalModel) {
                            oLocalModel.setProperty("/header/fromSloc", sSloc);
                        }
                        var oFromSlocInput = this.byId("idFromSlocInput");
                        if (oFromSlocInput) { oFromSlocInput.setValue(sSloc); }
                    }

                    if (typeof this.onSelectionChange === "function") {
                        this.onSelectionChange();
                    }
                }
            },
            onFromSlocInputSuggest: function (oEvent) {
                this._suggestSloc(oEvent, "from");
            },
            onToSlocInputSuggest: function (oEvent) {
                this._suggestSloc(oEvent, "to");
            },

            _suggestSloc: function (oEvent, sTarget) {
                var sTerm = oEvent.getParameter("suggestValue").trim();
                if (sTerm) {
                    var oLocalModel = this.getView().getModel("local");
                    this._filterSlocBinding(oEvent.getSource().getBinding("suggestionItems"),
                        this._getSlocPlant(oLocalModel, sTarget), sTerm);
                }
            },

            // ==========================================
            // STYLE VALUE HELP LOGIC
            // ==========================================

            onStyleInputSuggest: function (oEvent) {
                var sValue = oEvent.getParameter("suggestValue").trim();
                var sFromPlant = this.getView().getModel("local").getProperty("/header/fromPlant");
                var oBinding = oEvent.getSource().getBinding("suggestionItems");
                if (!sValue || !sFromPlant || !oBinding) {
                    return;
                }

                oBinding.filter(this._getStyleFilters(sFromPlant, sValue));
                if (oBinding.isSuspended()) {
                    oBinding.resume();
                }
            },

            onStyleInputSuggestionItemSelected: function (oEvent) {
                var oItem = oEvent.getParameter("selectedItem");
                if (oItem) {
                    var oContext = oItem.getBindingContext();
                    if (oContext) {
                        this._applySelectedStyle(oContext.getObject());
                    }
                }
            },

            onStyleInputValueHelpRequest: function () {
                var oView = this.getView();
                var oLocalModel = oView.getModel("local");

                var sFromPlant = oLocalModel ? oLocalModel.getProperty("/header/fromPlant") : "";
                if (!sFromPlant && this.byId("idFromPlantInput")) {
                    sFromPlant = this.byId("idFromPlantInput").getValue();
                }

                if (!sFromPlant) {
                    MessageToast.show("Please select From Plant first.");
                    return;
                }

                var fnApplyPlantFilter = function (oDialog) {
                    var oBinding = oDialog.getBinding("items");
                    if (oBinding) {
                        var oPlantFilter = new Filter("Plant", FilterOperator.EQ, sFromPlant);
                        oBinding.filter([oPlantFilter]);
                    }
                    oDialog.open();
                };

                if (this._oStyleDialog) {
                    fnApplyPlantFilter(this._oStyleDialog);
                    return;
                }

                this._fnOpenStyleDialog = fnApplyPlantFilter;
                if (this._pStyleDialog) {
                    return;
                }

                this._pStyleDialog = Fragment.load({
                    id: oView.getId() + "--StyleDialog",
                    name: "zfgtrns.view.StyleVH",
                    controller: this
                }).then(function (oDialog) {
                    var fnOpen = this._fnOpenStyleDialog;
                    this._pStyleDialog = null;
                    this._fnOpenStyleDialog = null;
                    if (!fnOpen) {
                        oDialog.destroy();
                        return;
                    }

                    this._oStyleDialog = oDialog;
                    oView.addDependent(oDialog);
                    fnOpen(oDialog);
                }.bind(this), function (oError) {
                    Log.error("Could not load Style value help", oError && (oError.stack || oError.message), "zfgtrns.controller.View1");
                    if (this._fnOpenStyleDialog) {
                        MessageToast.show("Could not open Style value help.");
                    }
                    this._fnOpenStyleDialog = null;
                    this._pStyleDialog = null;
                }.bind(this));
            },

            _destroyStyleDialog: function () {
                this._fnOpenStyleDialog = null;
                if (this._oStyleDialog) {
                    this._oStyleDialog.destroy();
                    this._oStyleDialog = null;
                }
            },

            onZiFgStyleTableSelectDialogSearch: function (oEvent) {
                var sValue = oEvent.getParameter("value");
                var oLocalModel = this.getView().getModel("local");
                var sFromPlant = oLocalModel ? oLocalModel.getProperty("/header/fromPlant") : "";
                var oBinding = oEvent.getSource().getBinding("items");
                if (oBinding) {
                    oBinding.filter(this._getStyleFilters(sFromPlant, sValue));
                }
            },

            _getStyleFilters: function (sFromPlant, sValue) {
                var aFilters = [];

                if (sFromPlant) {
                    aFilters.push(new Filter("Plant", FilterOperator.EQ, sFromPlant));
                }

                if (sValue) {
                    var oSearchFilter = new Filter({
                        filters: [
                            new Filter("StyleName", FilterOperator.Contains, sValue),
                            new Filter("StyleDesc", FilterOperator.Contains, sValue),
                            new Filter("BrandName", FilterOperator.Contains, sValue)
                        ],
                        and: false
                    });
                    aFilters.push(oSearchFilter);
                }

                return aFilters.length ? new Filter({ filters: aFilters, and: true }) : [];
            },

            onZiFgStyleTableSelectDialogConfirm: function (oEvent) {
                var oSelectedItem = oEvent.getParameter("selectedItem");
                if (!oSelectedItem) {
                    return;
                }

                var oContext = oSelectedItem.getBindingContext();
                var oSelectedData = oContext ? oContext.getObject() : null;
                if ((!oSelectedData || !oSelectedData.StyleName) && oSelectedItem.getCells) {
                    var aCells = oSelectedItem.getCells();
                    oSelectedData = {
                        StyleName: aCells[0] ? aCells[0].getText() : "",
                        BrandName: aCells[2] ? aCells[2].getText() : "",
                        ProductType: aCells[3] ? aCells[3].getText() : "",
                        Season: aCells[4] ? aCells[4].getText() : "",
                        subcat: aCells[5] ? aCells[5].getText() : ""
                    };
                }
                this._applySelectedStyle(oSelectedData || {});
            },

            _applySelectedStyle: function (oStyle) {
                var sStyle = oStyle.StyleName || "";
                var sBrand = oStyle.BrandName || "";
                var sCategory = oStyle.ProductType || "";
                var sSeason = oStyle.Season || "";
                var sSubCat = oStyle.subcat || "";
                var oLocalModel = this.getView().getModel("local");
                if (oLocalModel) {
                    oLocalModel.setProperty("/selection/style", sStyle);
                    oLocalModel.setProperty("/selection/brand", sBrand);
                    oLocalModel.setProperty("/selection/category", sCategory);
                    oLocalModel.setProperty("/selection/season", sSeason);
                    oLocalModel.setProperty("/selection/subCategory", sSubCat);
                }

                if (this.byId("idStyleInput")) { this.byId("idStyleInput").setValue(sStyle); }
                if (this.byId("idBrandInput")) { this.byId("idBrandInput").setValue(sBrand); }
                if (this.byId("idCategoryInput")) { this.byId("idCategoryInput").setValue(sCategory); }
                if (this.byId("idSeasonInput")) { this.byId("idSeasonInput").setValue(sSeason); }
                if (this.byId("idSubCategoryInput")) { this.byId("idSubCategoryInput").setValue(sSubCat); }
            },

         





            // ==========================================
            // BATCH VALUE HELP LOGIC
            // ==========================================

            onManualBatchInputValueHelpRequest: function () {
                var oView = this.getView();
                var oLocalModel = oView.getModel("local");

                var sPlant = oLocalModel ? oLocalModel.getProperty("/header/fromPlant") : "";
                var sSloc = oLocalModel ? oLocalModel.getProperty("/header/fromSloc") : "";
                var sStyle = oLocalModel ? oLocalModel.getProperty("/selection/style") : "";

                // if (!sStyle) {
                //     MessageToast.show("Please select Style first.");
                //     return;
                // }

                if (!this._oBatchDialog) {
                    Fragment.load({
                        id: oView.getId() + "--BatchDialog",
                        name: "zfgtrns.view.BatchVH",
                        controller: this
                    }).then(function (oDialog) {
                        this._oBatchDialog = oDialog;
                        oView.addDependent(this._oBatchDialog);
                        this._applyBatchFilters(sPlant, sSloc, sStyle);
                        this._oBatchDialog.open();
                    }.bind(this));
                } else {
                    this._applyBatchFilters(sPlant, sSloc, sStyle);
                    this._oBatchDialog.open();
                }
            },

            _applyBatchFilters: function (sPlant, sSloc, sStyle) {
                var aFilters = [];
                if (sPlant) {
                    aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
                }
                if (sSloc) {
                    aFilters.push(new Filter("StorageLocation", FilterOperator.EQ, sSloc));
                }
                if (sStyle) {
                    aFilters.push(new Filter("Material", FilterOperator.EQ, sStyle));
                }

                if (this._oBatchDialog) {
                    var oBinding = this._oBatchDialog.getBinding("items");
                    if (oBinding) {
                        oBinding.filter(aFilters);
                    }
                }
            },

            onBatchVHSearch: function (oEvent) {
                var sValue = oEvent.getParameter("value");
                var oLocalModel = this.getView().getModel("local");
                var sPlant = oLocalModel ? oLocalModel.getProperty("/header/fromPlant") : "";
                var sSloc = oLocalModel ? oLocalModel.getProperty("/header/fromSloc") : "";
                var sStyle = oLocalModel ? oLocalModel.getProperty("/selection/style") : "";

                var aFilters = [];
                if (sPlant) {
                    aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
                }
                if (sSloc) {
                    aFilters.push(new Filter("StorageLocation", FilterOperator.EQ, sSloc));
                }
                if (sStyle) {
                    aFilters.push(new Filter("Material", FilterOperator.EQ, sStyle));
                }

                if (sValue) {
                    aFilters.push(new Filter({
                        filters: [
                            new Filter("Batch", FilterOperator.Contains, sValue),
                            new Filter("Material", FilterOperator.Contains, sValue),
                            new Filter("ProductDescription", FilterOperator.Contains, sValue),
                            new Filter("SDDocument", FilterOperator.Contains, sValue),
                            new Filter("Color", FilterOperator.Contains, sValue),
                            new Filter("SizeSet", FilterOperator.Contains, sValue),
                            new Filter("LotNum", FilterOperator.Contains, sValue)
                        ],
                        and: false
                    }));
                }

                oEvent.getSource().getBinding("items").filter(aFilters);
            },

        onBatchVHConfirm: function (oEvent) {
        // 1. Retrieve contexts from selectedContexts or selectedItems
        var aSelectedContexts = oEvent.getParameter("selectedContexts") || [];
        var aSelectedItems = oEvent.getParameter("selectedItems") || [];
        var oSingleItem = oEvent.getParameter("selectedItem");

        // Fallback if selectedContexts parameter is empty
        if (aSelectedContexts.length === 0 && aSelectedItems.length > 0) {
            aSelectedContexts = aSelectedItems.map(function (oItem) {
                return oItem.getBindingContext();
            }).filter(Boolean);
        } else if (aSelectedContexts.length === 0 && oSingleItem) {
            var oSingleCtx = oSingleItem.getBindingContext();
            if (oSingleCtx) {
                aSelectedContexts.push(oSingleCtx);
            }
        }

        if (aSelectedContexts.length === 0) {
            return;
        }

        var oLocalModel = this.getView().getModel("local");
        var aCurrentItems = oLocalModel.getProperty("/fromLocationItems") || [];
        var sStyle = oLocalModel.getProperty("/selection/style") || "";
        var iAddedCount = 0;

        aSelectedContexts.forEach(function (oContext) {
            if (!oContext) {
                return;
            }

            var oRec = oContext.getObject();
            if (!oRec || !oRec.Batch) {
                return;
            }

            var sBatch = oRec.Batch || "";
            var sSDDoc = oRec.SDDocument || "";
            var sSDItem = oRec.SDDocumentItem || "";
            var sMaterial = oRec.Material || "";
            var sPlant = oRec.Plant || "";
            var sSloc = oRec.StorageLocation || "";

            // Unique Composite Key Check: Batch + Sales Order + Line Item + Material + Plant + SLoc
            var bAlreadyExists = aCurrentItems.some(function (item) {
                return (item.batch || "") === sBatch &&
                    (item.salesOrder || "") === sSDDoc &&
                    (item.soLineItem || "") === sSDItem &&
                    (item.material || "") === sMaterial &&
                    (item.plant || "") === sPlant &&
                    (item.storageLocation || "") === sSloc;
            });

            if (!bAlreadyExists) {
                var nQty = Number(parseFloat(oRec.QTY || 0).toFixed(3));

                aCurrentItems.push({
                    salesOrder: sSDDoc,
                    soLineItem: sSDItem,
                    style: sStyle || sMaterial,
                    material: sMaterial,
                    color: oRec.Color || "",
                    size: oRec.SizeSet || "",
                    lotNo: oRec.LotNum || "",
                    batch: sBatch,
                    quantity: nQty,
                    uom: oRec.MaterialBaseUnit || "PC",
                    plant: sPlant,
                    storageLocation: sSloc
                });
                iAddedCount++;
            }
        });

        if (iAddedCount > 0) {
            oLocalModel.setProperty("/fromLocationItems", aCurrentItems);
            this._recalculateFromTotalQty();
            MessageToast.show(iAddedCount + " batch item(s) added successfully.");
        } else {
            MessageToast.show("Selected item(s) are already in the list.");
        }
    },

            _fetchAndAddMultipleBatchDetails: function (aBatchNos) {
                var oView = this.getView();
                var oLocalModel = oView.getModel("local");
                var oODataModel = oView.getModel();

                var sPlant = oLocalModel.getProperty("/header/fromPlant");
                var sSloc = oLocalModel.getProperty("/header/fromSloc");

                var aCurrentItems = oLocalModel.getProperty("/fromLocationItems") || [];

                var aNewBatchNos = aBatchNos.filter(function (sBatchNo) {
                    return !aCurrentItems.some(function (item) {
                        return item.batch === sBatchNo;
                    });
                });

                if (aNewBatchNos.length === 0) {
                    MessageToast.show("Selected batch(es) are already in the list.");
                    return;
                }

                oView.setBusy(true);

                var aBatchFilters = aNewBatchNos.map(function (sBatchNo) {
                    return new Filter("Batch", FilterOperator.EQ, sBatchNo);
                });

                var aFilters = [
                    new Filter({
                        filters: aBatchFilters,
                        and: false
                    })
                ];

                if (sPlant) {
                    aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
                }
                if (sSloc) {
                    aFilters.push(new Filter("StorageLocation", FilterOperator.EQ, sSloc));
                }

                var oListBinding = oODataModel.bindList("/ZI_GET_BATCH_FG", null, null, aFilters, {
                    $select: "Batch,Material,ProductDescription,Color,SizeSet,LotNum,Plant,StorageLocation,SDDocument,SDDocumentItem,QTY,MaterialBaseUnit"
                });

                oListBinding.requestContexts(0, 100).then(function (aContexts) {
                    oView.setBusy(false);

                    if (!aContexts || aContexts.length === 0) {
                        sap.m.MessageBox.error("No stock details found for selected batches.");
                        return;
                    }

                    aContexts.forEach(function (oContext) {
                        var oRec = oContext.getObject();
                        var nQty = Number(parseFloat(oRec.QTY || 0).toFixed(3));

                        aCurrentItems.push({
                            salesOrder: oRec.SDDocument,
                            soLineItem: oRec.SDDocumentItem,
                            style: oLocalModel.getProperty("/selection/style") || "",
                            material: oRec.Material,
                            color: oRec.Color || "",
                            size: oRec.SizeSet || "",
                            lotNo: oRec.LotNum || "",
                            batch: oRec.Batch,
                            quantity: nQty,
                            uom: oRec.MaterialBaseUnit,
                            plant: oRec.Plant,
                            storageLocation: oRec.StorageLocation
                        });
                    });

                    oLocalModel.setProperty("/fromLocationItems", aCurrentItems);
                    this._recalculateFromTotalQty();
                    MessageToast.show(aContexts.length + " batch(es) added successfully.");
                }.bind(this)).catch(function (oError) {
                    oView.setBusy(false);
                    sap.m.MessageBox.error("Failed to fetch batch data from server.");
                });
            },

            onScannedBatchInputSubmit: function (oEvent) {
                var sScannedValue = oEvent.getParameter("value") || oEvent.getSource().getValue();
                if (!sScannedValue) {
                    return;
                }

                this._fetchAndAddBatchDetails(sScannedValue);

                var oLocalModel = this.getView().getModel("local");
                oLocalModel.setProperty("/selection/scannedBatch", "");
            },

            onManualBatchInputSubmit: function () {
                var oLocalModel = this.getView().getModel("local");
                var sMode = oLocalModel.getProperty("/header/selectionMode");
                var sBatch = sMode === "MANUAL"
                    ? oLocalModel.getProperty("/selection/manualBatch")
                    : oLocalModel.getProperty("/selection/scannedBatch");

                if (sBatch) {
                    this._fetchAndAddBatchDetails(sBatch);
                } else {
                    MessageToast.show("Please select or scan a batch first.");
                }
            },

            onBatchVHCancel: function (oEvent) {
                var oBinding = oEvent.getSource().getBinding("items");
                if (oBinding) {
                    oBinding.filter([]);
                }
            },

            onDeleteButtonPress: function () {
        var oTable = this.byId("idFromLocationItemsTable");
        var aSelectedItems = oTable.getSelectedItems();

        if (aSelectedItems.length === 0) {
            MessageToast.show("Please select at least one item to delete.");
            return;
        }

        MessageBox.confirm("Are you sure you want to delete the selected item(s)?", {
            title: "Confirm Deletion",
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            emphasizedAction: MessageBox.Action.NO, // Highlights 'NO' to avoid accidental deletion
            onClose: function (oAction) {
                if (oAction === MessageBox.Action.YES) {
                    var oLocalModel = this.getView().getModel("local");
                    var aCurrentItems = oLocalModel.getProperty("/fromLocationItems") || [];

                    var aSelectedContexts = aSelectedItems.map(function (oItem) {
                        return oItem.getBindingContext("local").getObject();
                    });

                    var aUpdatedItems = aCurrentItems.filter(function (oItem) {
                        return !aSelectedContexts.includes(oItem);
                    });

                    oLocalModel.setProperty("/fromLocationItems", aUpdatedItems);
                    oTable.removeSelections(true);

                    this._recalculateFromTotalQty();
                    MessageToast.show("Selected item(s) deleted successfully.");
                }
            }.bind(this) // Bound to preserve controller 'this' scope
        });
    },

            _fetchAndAddBatchDetails: function (sBatchNo) {
                var oView = this.getView();
                var oLocalModel = oView.getModel("local");
                var oODataModel = oView.getModel();

                var sPlant = oLocalModel.getProperty("/header/fromPlant");
                var sSloc = oLocalModel.getProperty("/header/fromSloc");

                if (!sBatchNo) {
                    MessageToast.show("Please enter or scan a valid batch number.");
                    return;
                }

                oView.setBusy(true);

                var aFilters = [
                    new Filter("Batch", FilterOperator.EQ, sBatchNo)
                ];

                if (sPlant) {
                    aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
                }
                if (sSloc) {
                    aFilters.push(new Filter("StorageLocation", FilterOperator.EQ, sSloc));
                }

                var oListBinding = oODataModel.bindList("/ZI_GET_BATCH_FG", null, null, aFilters, {
                    $select: "Batch,Material,ProductDescription,Color,SizeSet,LotNum,Plant,StorageLocation,SDDocument,SDDocumentItem,QTY,MaterialBaseUnit"
                });

                oListBinding.requestContexts(0, 100).then(function (aContexts) {
                    oView.setBusy(false);

                    if (!aContexts || aContexts.length === 0) {
                        sap.m.MessageBox.error("No stock found for Batch: " + sBatchNo);
                        return;
                    }

                    var aCurrentItems = oLocalModel.getProperty("/fromLocationItems") || [];

                    var bAlreadyExists = aCurrentItems.some(function (item) {
                        return item.batch === sBatchNo;
                    });

                    if (bAlreadyExists) {
                        MessageToast.show("Batch " + sBatchNo + " is already in the list.");
                        return;
                    }

                    aContexts.forEach(function (oContext) {
                        var oRec = oContext.getObject();
                        var nQty = Number(parseFloat(oRec.QTY || 0).toFixed(3));

                        aCurrentItems.push({
                            salesOrder: oRec.SDDocument,
                            soLineItem: oRec.SDDocumentItem,
                            style: oLocalModel.getProperty("/selection/style") || "",
                            material: oRec.Material,
                            color: oRec.Color || "",
                            size: oRec.SizeSet || "",
                            lotNo: oRec.LotNum || "",   
                            batch: oRec.Batch,
                            quantity: nQty,
                            uom: oRec.MaterialBaseUnit,
                            plant: oRec.Plant,
                            storageLocation: oRec.StorageLocation
                        });
                    });

                    oLocalModel.setProperty("/fromLocationItems", aCurrentItems);
                    this._recalculateFromTotalQty();
                    MessageToast.show("Batch " + sBatchNo + " added successfully.");
                }.bind(this)).catch(function (oError) {
                    oView.setBusy(false);
                    sap.m.MessageBox.error("Failed to fetch batch data from server.");
                });
            },

            _recalculateFromTotalQty: function () {
    var oLocalModel = this.getView().getModel("local");
    var aItems = oLocalModel.getProperty("/fromLocationItems") || [];
    var iTotal = 0;

    aItems.forEach(function (item) {
        iTotal += parseFloat(item.quantity) || 0;
    });

    iTotal = Number(iTotal.toFixed(3));
    
    // Update both total quantity and item count
    oLocalModel.setProperty("/fromTotalQty", iTotal);
    oLocalModel.setProperty("/fromItemCount", aItems.length);
},

            onQuantityInputChange: function (oEvent) {
                var oLocalModel = this.getView().getModel("local");
                var aItems = oLocalModel.getProperty("/fromLocationItems") || [];

                var iTotal = 0;
                aItems.forEach(function (item) {
                    item.quantity = Number(parseFloat(item.quantity || 0).toFixed(3));
                    iTotal += item.quantity;
                });

                iTotal = Number(iTotal.toFixed(3));

                oLocalModel.setProperty("/fromLocationItems", aItems);
                oLocalModel.setProperty("/fromTotalQty", iTotal);
            },

           onSubmitTransferButtonPress: function () {
    var oView = this.getView();
    var oLocalModel = oView.getModel("local");
    var oODataModel = oView.getModel();

    if (oLocalModel.getProperty("/postingSuccessful") || oView.getBusy()) {
        return;
    }

    var oHeader = oLocalModel.getProperty("/header") || {};
    var oSelection = oLocalModel.getProperty("/selection") || {};
    var aScannedBatches = oLocalModel.getProperty("/fromLocationItems") || [];

    // 1. Mandatory Header Field Validation
    if (!oHeader.fromPlant || !oHeader.toPlant || !oHeader.fromSloc || !oHeader.toSloc || !oHeader.postingDate) {
        MessageBox.error("Please fill in all mandatory fields: From/To Plant, From/To Storage Location, and Posting Date.");
        return;
    }

    // 2. Item List Validation
    if (aScannedBatches.length === 0) {
        MessageBox.error("There are no items in the table to submit.");
        return;
    }

    for (var i = 0; i < aScannedBatches.length; i++) {
        var oBatch = aScannedBatches[i];
        var fQtyToTransfer = parseFloat(oBatch.quantity ?? oBatch.qty) || 0;
        var sBatchNo = oBatch.batch || oBatch.FromBatch || "";

        if (fQtyToTransfer <= 0) {
            MessageBox.error(
                "Error on Batch " + sBatchNo + ":\n\n" +
                "Quantity to Transfer must be greater than zero."
            );
            return;
        }
    }

    // 3. Helper Functions for String Padding & Date Formatting
    var fnPadStart = function (vVal, iLen) {
        if (!vVal) return "";
        return String(vVal).padStart(iLen, "0");
    };

    // Format "DD.MM.YYYY" or Date Object to "YYYY-MM-DD"
    var sRawDate = oHeader.postingDate;
    var sFormattedDate = "";
    if (sRawDate instanceof Date) {
        var sY = sRawDate.getFullYear();
        var sM = String(sRawDate.getMonth() + 1).padStart(2, "0");
        var sD = String(sRawDate.getDate()).padStart(2, "0");
        sFormattedDate = sY + "-" + sM + "-" + sD;
    } else if (typeof sRawDate === "string" && sRawDate.includes(".")) {
        var aParts = sRawDate.split(".");
        if (aParts.length === 3) {
            sFormattedDate = aParts[2] + "-" + aParts[1] + "-" + aParts[0];
        }
    } else {
        sFormattedDate = sRawDate || "";
    }

    // 4. Map Line Items Payload (Matches ZC_FG_TRNS_IT)
    var aItemsPayload = aScannedBatches.map(function (oBatch) {
        var nQty = parseFloat(oBatch.quantity ?? oBatch.qty) || 0;
        var sFromBatch = oBatch.batch || oBatch.FromBatch || "";
        var sToBatch = oBatch.toBatch || oBatch.transferBatch || sFromBatch;
        var sSo = oBatch.salesOrder || oBatch.SalesOrder || "";
        var sSoItem = oBatch.soLineItem || oBatch.salesOrderItem || oBatch.SalesOrderItem || "";

        return {
            "Material": oBatch.material || "",
            "Qty": String(nQty),
            "Unit": oBatch.uom || "PC",
            "Batch": sFromBatch,
            "ToBatch": sToBatch,
            "SalesOrder": fnPadStart(sSo, 10),
            "SalesOrderItem": fnPadStart(sSoItem, 6),
            "Style": oBatch.style || oSelection.style || ""
        };
    });

    // 5. Build Header Payload (Exact field mapping to ZC_FG_TRNS_HD)
    var oPayload = {
        "FromPlant": oHeader.fromPlant,
        "ToPlant": oHeader.toPlant,
        "FromStorloc": oHeader.fromSloc,
        "ToStorloc": oHeader.toSloc,
        "PostingDate": sFormattedDate,
        "Style": oSelection.style || "",
        "Remark": oHeader.remark || "",
        "_Item": aItemsPayload
    };

    // Decide success / error ONLY on MatDoc
    var fnShowResult = function (sMatDoc, sMess) {
        var sDoc = (sMatDoc || "").trim();
        var bHasMatDoc = sDoc !== "" && !/^0+$/.test(sDoc);

        if (bHasMatDoc) {
            oLocalModel.setProperty("/postingSuccessful", true);
            MessageBox.success("Transfer Posting " + sDoc + " created successfully!", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._resetTransferForm(true);
                    }
                }.bind(this)
            });
        } else {
            // Keep the screen data so the user can correct and resubmit
            MessageBox.error(
                (sMess && sMess.trim()) ? sMess : "Material document was not created. Please check the data and try again."
            );
        }
    }.bind(this);

    oView.setBusy(true);

    // 6. OData V4 List Binding Create on Projection View ZC_FG_TRNS_HD
    var oListBinding = oODataModel.bindList("/ZC_FG_TRNS_HD");
    var oContext = oListBinding.create(oPayload);

    oContext.created().then(function () {
        // MatDoc / Mess are filled during the save phase, so re-read the
        // record from the backend instead of trusting the POST response
        var oReadBinding = oODataModel.bindContext(oContext.getPath());
        return oReadBinding.requestObject().then(function (oData) {
            oView.setBusy(false);
            oData = oData || {};
            fnShowResult(oData.MatDoc, oData.Mess);
        }, function () {
            // Fallback: use whatever came back with the create response
            oView.setBusy(false);
            fnShowResult(oContext.getProperty("MatDoc"), oContext.getProperty("Mess"));
        });

    }).catch(function (oError) {
        oView.setBusy(false);
        var sErrorMsg = "Failed to post FG Transfer due to a server/network error.";
        if (oError && oError.message) {
            sErrorMsg = oError.message;
        }
        MessageBox.error(sErrorMsg);
    });
},
            onClearButtonPress: function () {
                this._resetTransferForm();
            },

            onNewButtonPress: function () {
                this._resetTransferForm();
            },

            _resetTransferForm: function (bPostingSuccessful) {
                var oData = this._createTransferFormData();
                oData.postingSuccessful = Boolean(bPostingSuccessful);
                this.getView().getModel("local").setData(oData);
                sap.ui.getCore().getMessageManager().removeAllMessages();
                if (!bPostingSuccessful) {
                    this.byId("idFromPlantInput").focus();
                }
            }
        });
    });
