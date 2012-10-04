Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    layout: {
        type: 'fit'
    },

    launch: function() {

        this._loadBuildDefs();


        /*  // Creates a table using Rally ui      
            Rally.data.ModelFactory.getModel({
                    type:'Build Definition',
                    scope:this,
                    success: function(model){
                        
                        var myGrid = Ext.create('Rally.ui.grid.Grid',{
                            model: model,
                            columnCfgs: [
                                'Name',
                                'Description',
                                'LastStatus'
                                ]
                        });
                        this.add(myGrid);
                                
                        
                    },
                    context: {
                        workspace: "/workspace/4365660833"
                    }
                    
                });
        */

    },

    // Creates a query for specific build definitions
    _createQuery: function(buildDefRecords) {

        // get first entry
        var q = Ext.create('Rally.data.QueryFilter', {
            property: 'BuildDefinition',
            operator: '=',
            value: buildDefRecords[0].get('_ref')
            //            value: '/slm/webservice/1.37/builddefinition/6035424766' //PacSystems Mainline Build Definition
        });

        // remove teh first entry
        Ext.Array.remove(buildDefRecords, buildDefRecords[0]);

        // cycle through the remaineder in the array
        Ext.Array.forEach(buildDefRecords, function(item, index, allItems) {
            q = q.or(Ext.create('Rally.data.QueryFilter', {
                property: 'BuildDefinition',
                operator: '=',
                value: item.get('_ref')
            }));
        });

        console.log("query = ", q.toString());

        return q;

    },

    _getBuilds: function(buildDefRecords) {
        var query = this._createQuery(buildDefRecords);


        Ext.create('Rally.data.WsapiDataStore', {
            model: 'Build',
            fetch: true,
            listeners: {
                load: function(store, records, success) {
                    console.log("Fetched %d builds", records.length);
                    Ext.Array.forEach(records, function(item) {
                        //                        console.log("Name: %s, Def: %s, Status %s", item.get("Number"), item.get("BuildDefinition")._ref, item.get("Status"));
                    });
                    this._siftBuilds(records);
                },
                scope: this
            },
            sorters: [{
                property: 'CreationDate',
                direction: 'DESC'
            }],
            filters: query,
            autoLoad: true,
            pageSize: 100
        });
    },

    _loadBuildDefs: function() {

        Ext.create('Rally.data.WsapiDataStore', {
            model: 'Build Definition',
            fetch: true,
            listeners: {
                load: function(store, records, success) {
                    console.log("Loaded %d Build Definitions.", records.length);

                    this.buildDefinitions = [];
                    Ext.Array.forEach(records, function(item) {
                        Ext.Array.push(this.buildDefinitions, item.get("_ref"));

                    }, this);
                    console.log("Build definitions array ", this.buildDefinitions);

                    this._getBuilds(records);
                },
                scope: this
            },
            autoLoad: true
        });

    },

    // creates the build def/ build record data struct
    _siftBuilds: function(buildDefBuildRecords) {

        var buildStructure = {};

        // Create a build structure
        Ext.Array.forEach(buildDefBuildRecords, function(item) {
            build = item;
            buildDef = item.get("BuildDefinition")._ref;
            //console.log(item.get("BuildDefinition"));

            if (!buildStructure.hasOwnProperty(buildDef)) {
                buildStructure[buildDef] = {
                    buildDefName: item.get("BuildDefinition")._refObjectName,
                    builds: [build],
                    lastBuild: null,
                    failCount: 0
                };
                //                console.log("Added new build def %s",buildDef);

            }
            else {
                Ext.Array.push(buildStructure[buildDef].builds, build);
                //                console.log("Pushed build  %s",item.get("Number"));
            }


        });

        //Now update the lastGoodBuild and failCount fields

        // for each build ref
        //    for each build
        //      if build failed
        //          increment failCount
        //      else
        //          set lastGoodBuild
        //          break;
        Ext.Array.forEach(this.buildDefinitions, function(item) {

            var buildDef = item;
            buildStructure[buildDef].failCount = 0;

            //            console.log("Working on %s",buildDef);

            Ext.Array.forEach(buildStructure[item].builds, function(item) {

                var build = item;

                if (build.get("Status") === "FAILURE") {
                    if (buildStructure[buildDef].lastGoodBuild == undefined) {
                        buildStructure[buildDef].failCount = buildStructure[buildDef].failCount + 1;
                        //                        console.log("%s failed, failCount %d",build.get("Number"), buildStructure[buildDef].failCount);
                    }
                    else {
                        return;
                    }
                }
                else {
                    //                    console.log("%s succeeded, failCount %d",build.get("Number"), buildStructure[buildDef].failCount);
                    buildStructure[buildDef].lastGoodBuild = build;
                    return;
                }

            });

            console.log("Build %s Fails %d", buildDef, buildStructure[buildDef].failCount);

        });
        console.log(buildStructure);

        gridFormattedBuilds = [];
        var count = 0;
        //format data into a new grid-freindly array
        Ext.Array.forEach(this.buildDefinitions, function(item) {
            var buildDef = item;

            gridFormattedBuilds[count] = {};
            gridFormattedBuilds[count].Name = buildStructure[buildDef].buildDefName; //i.e : "PACSystems Mainline CI Builds"

            //todo: make sure a build exists
            gridFormattedBuilds[count].Status = buildStructure[buildDef].builds[0].get("Status");
            gridFormattedBuilds[count].CurrentBuild = buildStructure[buildDef].builds[0].get("Number");
            gridFormattedBuilds[count].LastGoodBuild = buildStructure[buildDef].lastGoodBuild.get("Number");
            gridFormattedBuilds[count].NumFailedBuilds = buildStructure[buildDef].failCount;
            
            //field for build refs
            gridFormattedBuilds[count].CurrentBuildRef = buildStructure[buildDef].builds[0].get('_ref');
            gridFormattedBuilds[count].LastGoodBuildRef = buildStructure[buildDef].lastGoodBuild.get('_ref');

            count++;
        });
        console.log("Grid Array:");
        console.log(gridFormattedBuilds);

        // Motion Hack - fix junked motion build ID's
        if (count >= 3)
        {
            gridFormattedBuilds[2].CurrentBuild = 'MOTION_CI_R59632_40E1'; 
            gridFormattedBuilds[2].LastGoodBuild = 'MOTION_CI_R59632_40E1'; 
        }

        //pipe it into a store
        Ext.create('Ext.data.Store', {
            storeId: 'ciBuildStore',
            fields: ['Name', 'Status', 'CurrentBuild', 'LastGoodBuild', 'NumFailedBuilds'],
            data: gridFormattedBuilds

        });

        // Color
        var statusTpl = new Ext.XTemplate(
            "<tpl switch='Status'>", 
                "<tpl case='SUCCESS'>", 
                    "<div style='background-color:#07C600; width:100%; padding: 3px'> {Status}; </div>", 
                "<tpl default>", 
                    "<div style='background-color:#FF0000; width:100%; padding: 3px'> {Status}; </div>", 
            "</tpl>");
        var currentBuildTpl = new Ext.XTemplate(
            "<tpl switch='Status'>", 
                "<tpl case='SUCCESS'>", 
                    "<div style='background-color:#07C600; color:#FFF;font-weight:bold; width:100%; padding: 3px'> {CurrentBuild} </div>", 
                "<tpl default>", 
                    "<div style='background-color:#FF0000; color:#FFF;font-weight:bold; width:100%; padding: 3px'> {CurrentBuild} </div>", 
            "</tpl>");

        var lastGoodBuildTpl = new Ext.XTemplate(
            "<tpl>", 
                    "<div style='background-color:#07C600; color:#FFF;font-weight:bold; width:100%; padding: 3px'> {LastGoodBuild} </div>", 
            "</tpl>");

        //{
        //    text: 'Verdict', dataIndex: 'Verdict', width: 95, 
        //    renderer: function(value){
        //        if((value === "Fail") || (value === "Error") || (value === "Blocked")){
        //            return Ext.String.format("<div style='background-color:#FF0000;color:#FFF;font-weight:bold;text-align:center;padding: 3px'>{0}</div>", value);
        //        } else if ( value === "Inconclusive" ) {
        //            return Ext.String.format("<div style='background-color:#ccc;color:#000;font-weight:bold;text-align:center;padding: 3px'>{0}</div>", value);
        //        }else{
        //            return Ext.String.format("<div style='background-color:#07C600;color:#000;font-weight:bold;text-align:center;padding: 3px'>{0}</div>", value);
        //        }
        //    }
        //}

        var myGrid = Ext.create('Ext.grid.Panel', {
//            title: 'Build Status',
            store: Ext.data.StoreManager.lookup('ciBuildStore'),
            columns: [
                { text: 'Name', dataIndex: 'Name', width: 205 }, 
//                { text: 'Status', dataIndex: 'Status', flex: 1, xtype: 'templatecolumn', tpl: statusTpl},
                { text: 'Current Build', dataIndex: 'CurrentBuild', width: 175, xtype: 'templatecolumn', tpl: currentBuildTpl}, 
                { text: 'Last Good Build', dataIndex: 'LastGoodBuild', width: 175, xtype: 'templatecolumn', tpl: lastGoodBuildTpl }, 
                { text: 'Num Fails', dataIndex: 'NumFailedBuilds', width: 50, tooltip: 'Number of failed builds since the last success', tooltipType: "qtip"},
                { menuDisabled: true, sortable: false, xtype: 'actioncolumn',items: [{
                    icon: 'https://raw.github.com/skandl/BuildActionBoard/master/button_got_it_text.jpg',
                    iconCls: 'gotItButton',
                    tooltip: 'I got it',
                    handler: function(grid, rowIndex, colIndex) {
                        console.log("Selected row %d", rowIndex);
                    }}],
                }, 
                { menuDisabled: true, sortable: false, xtype: 'actioncolumn',items: [{
                    icon: 'https://raw.github.com/skandl/BuildActionBoard/master/button_got_it_text.jpg',
                    iconCls: 'buildItButton',
                    tooltip: 'Launch build now',
                    handler: function(grid, rowIndex, colIndex) {
                        console.log("Selected row %d", rowIndex);
                    }}],
                }, 
                {text: 'Build Savior', dataIndex: 'Owner', flex: 1}
            ],
            listeners: {
                cellclick: function(table, td, cellIndex, record, tr, rowIndex){
                    // cellIndex 1 is current build
                    //todo qualify index into array
                    if (cellIndex === 1)
                    {
                        console.log(gridFormattedBuilds[rowIndex].CurrentBuildRef);
    		Rally.environment.getMessageBus().publish('buildSelected', gridFormattedBuilds[rowIndex].CurrentBuildRef);

                        
                    }
                    
                    if (cellIndex === 2)
                    {
                        console.log(gridFormattedBuilds[rowIndex].CurrentBuildRef);
                        console.log(gridFormattedBuilds[rowIndex].LastGoodBuildRef);
                        Rally.environment.getMessageBus().publish('buildSelected', gridFormattedBuilds[rowIndex].LastGoodBuildRef);
                    }   
                    console.log("cell click %d %d",cellIndex, rowIndex);
                    
                }
            },
            height: 200
            //            plugins: [{
            //                ptype: 'rowexpander',
            //                rowBodyTpl: new Ext.XTemplate('foo')
            //            }],
            //            collapsible: true,
            //            animCollapse: false
        });

        this.add(myGrid);

    }

});
