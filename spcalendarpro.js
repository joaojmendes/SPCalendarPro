/*
* @name SPCalendarPro
* Version 2018.02
* No dependencies!
* @description An ultra lightweight JavaScript library to easily manage SharePoint calendar events.
* @category Plugins/SPCalendarPro
* @author Sam Perrow sam.perrow399@gmail.com
*
* Copyright 2018  Sam Perrow  (email : sam.perrow399@gmail.com)
* Licensed under the MIT license:
* http://www.opensource.org/licenses/mit-license.php
*/

(function (global, factory) {
    global.spcalpro = factory();
    }(this, function() {

        function getSPEnvInfo(sourceSite) {
            var spVersion = _spPageContextInfo.webUIVersion;
            
            return {
                year: (spVersion === 15) ? '2013' : '2010',
                soapURL: sourceSite 
                    ? sourceSite + '/_vti_bin/Lists.asmx'
                    : (spVersion === 15) ? _spPageContextInfo.webAbsoluteUrl + '/_vti_bin/Lists.asmx' : document.location.protocol + '//' + document.location.host + _spPageContextInfo.webServerRelativeUrl + '/_vti_bin/Lists.asmx',
            }
        }

        // checks if supplied datetimes are the same date as ones in calendar list.
        SPCalendarPro.prototype.isSameDate = function() {
            var reqbeginDate = this.userDateTimes.beginDate;
            var reqEndDate = this.userDateTimes.endDate;

            this.listData = this.listData.filter(function(event) {
                return event.EventDate.toDateString() === reqbeginDate && event.EndDate.toDateString() === reqEndDate;
            });

            return this;
        }

        // provide begin/end datetimes, and this method will check for events that fall in that range..
        SPCalendarPro.prototype.matchDateTimes = function() {
            var reqBeginDT = this.userDateTimes.beginDateTime;
            var reqEndDT = this.userDateTimes.endDateTime;

            this.listData = this.listData.filter(function(event) {
                return (event.EventDate <= reqBeginDT) && (event.EndDate >= reqEndDT);
            });

            return this;
        }

        // checks for time conflicts between provided begin/end datetime and events
        SPCalendarPro.prototype.isTimeConflict = function() {
            var reqBeginDT = this.userDateTimes.beginDateTime;
            var reqEndDT = this.userDateTimes.endDateTime;

            this.listData = this.listData.filter(function(event) {
                var arrBeginDT = event.EventDate;
                var arrEndDT = event.EndDate;
        
                return (
                    (reqBeginDT <= arrBeginDT && reqEndDT >= arrEndDT) || (arrBeginDT < reqBeginDT && arrEndDT > reqBeginDT)
                    || (arrBeginDT < reqEndDT && arrEndDT > reqEndDT) || (reqBeginDT < arrBeginDT && reqEndDT > arrEndDT) );
            });

            return this;
        }

        // couldn't do without a where clause now could we?
        SPCalendarPro.prototype.where = function(str) {
            var fieldName = str.split(' ')[0];
            var operation = str.split(' ')[1];
            var value = str.split(' ')[2];

            var operators = {
                '=': function(a, b) { return a == b },
                '>': function(a, b) { return a > new Number(b) },
                '<': function(a, b) { return a < new Number(b) },
                '>=': function(a, b) { return a >= new Number(b) },
                '<=': function(a, b) { return a <= new Number(b) },
                '!=': function(a, b) { return a != b },
            }

            this.listData = this.listData.filter(function(event) {
                return operators[operation](event[fieldName], value);
            });

            return this;
        }

        // this will convert date/time info from a sharepoint form into proper date objects to be used later.
        SPCalendarPro.prototype.getDateTimesFromForm = function(row1, row2) {
            var formattedDT = convertFormDateTimes(row1, row2);
            this.userDateTimes = formatDateTimesToObj(formattedDT.userBeginDT, formattedDT.userEndDT);
            return this;
        }

        // // user directly supplies begin and end datetimes
        SPCalendarPro.prototype.getEventsAfterToday = function() {
            this.listData = this.listData.filter(function(event) {
                var today = new Date();
                return (event.EventDate >= today || event.EndDate >= today);
            });
            return this;
        }

        // // user directly supplies begin and end datetimes
        SPCalendarPro.prototype.provideDateTimes = function(datetime1, datetime2) {
            this.userDateTimes = formatDateTimesToObj(datetime1, datetime2);
            return this;
        }


        // to be used internally, only for formatted the provided datetimes into other formats.
        function formatDateTimesToObj(beginDT, endDT) {
            return {
                beginDateTime: beginDT,
                beginDate: new Date(beginDT.toDateString()),
                beginTime: beginDT.toTimeString(),
                endDateTime: endDT,
                endDate: new Date(endDT.toDateString()),              
                endTime: endDT.toTimeString()
            };
        }

        
        // get single, recurring, or all calendar events
        var getListData = function(obj, async, type, listType) {
            var doAsync = (typeof async === 'undefined' || typeof async === undefined) ? true : async;

            // set up the CAML query. returns single and recurring events by default, unless otherwise specified.
            var soapHeader = "<soap:Envelope xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'><soap:Body><GetListItems xmlns='http://schemas.microsoft.com/sharepoint/soap/'><listName>" + obj.listName + "</listName>";
            var soapFooter = "</soap:Body></soap:Envelope>";

            var beginRecurringCaml = "<DateRangesOverlap><FieldRef Name='EventDate'/><FieldRef Name='EndDate'/><FieldRef Name='RecurrenceID'/><Value Type='DateTime'><Year/></Value></DateRangesOverlap>";
            var endRecurringCaml = "</Where><OrderBy><FieldRef Name='EventDate'/></OrderBy></Query></query><queryOptions><QueryOptions><RecurrencePatternXMLVersion>v3</RecurrencePatternXMLVersion><ExpandRecurrence>TRUE</ExpandRecurrence><RecurrenceOrderBy>TRUE</RecurrenceOrderBy><ViewAttributes Scope='RecursiveAll'/></QueryOptions></queryOptions></GetListItems>";
            var singleQuery = "<query><Query><Where><Eq><FieldRef Name='fRecurrence'/><Value Type='Number'>0</Value></Eq></Where>/Query></query></GetListItems>";
            var recurringQuery = "<query><Query><Where><And>" + beginRecurringCaml + "<Eq><FieldRef Name='fRecurrence'/><Value Type='Number'>1</Value></Eq></And>" + endRecurringCaml;
            var query = "";
            var fieldNames = (obj.fields) ? getFieldNames() : '';

            if (listType === 'calendar') {
                if (type === 'single') {
                    query = singleQuery;
                } else if (type === 'recurring') {
                    query = recurringQuery;
                } else {
                    query = "<query><Query><Where>" + beginRecurringCaml + endRecurringCaml;
                }
            } else if (listType === 'list') {
                query = "<viewFields><ViewFields>" + fieldNames + "</ViewFields></viewFields></GetListItems>";
            }
            
            function getFieldNames() {
                var viewFields = '';
                for (var i = 0; i < obj.fields.length; i++) {
                    viewFields += "<FieldRef Name='" + obj.fields[i] + "'/>";
                }
                return viewFields;
            }

            postAjax(soapHeader + query + soapFooter);

            // make ajax request. fires synchronously by default. No j-word needed!
            function postAjax(soapStr) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', obj.SPInfo.soapURL, doAsync);
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Content-Type', 'text/xml;charset="utf-8"');
                xhr.send(soapStr);

                xhr.onerror = function() {
                    reportError(xhr);
                }
                
                return (doAsync === true) ? xhr.onload = function() { return getEvents(xhr) } : getEvents(xhr);
            }

            function reportError(xhr) {
                if (xhr.status == 500) {
                    return obj.error = {
                        errorCode: xhr.responseText.split('<errorcode xmlns="http://schemas.microsoft.com/sharepoint/soap/">')[1].split('</errorcode>')[0],
                        errorString: xhr.responseText.split('<errorstring xmlns="http://schemas.microsoft.com/sharepoint/soap/">')[1].split('</errorstring>')[0],
                        faultString: xhr.responseText.split('<faultstring>')[1].split('</faultstring>')[0],
                    }
                } else {
                    return obj.error = "Request failed.";
                }
            }

            function getEvents(xhr) {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    obj.listData = XmlToJson( xhr.responseXML.querySelectorAll('*') );
                    return obj.callback(obj);
                } else {
                    reportError(xhr);
                }
            }

            // accepts XML, returns an array of objects, each of which are calendar events.
            function XmlToJson(xml) {
                var eventArr = [];

                for (var i = 0; i < xml.length; i++) {
                    var row = {};
                    var rowAttrs = xml[i].attributes;

                    if (xml[i].nodeName === 'z:row') {

                        for (var attrNum = 0; attrNum < rowAttrs.length; attrNum++) {
                            var thisAttrName = rowAttrs[attrNum].name.split("ows_")[1];
                                                    
                            row[thisAttrName] = (thisAttrName === 'EventDate' || thisAttrName === 'EndDate')
                                ? new Date(rowAttrs[attrNum].value.replace('-', '/'))
                                : rowAttrs[attrNum].value;
                        }

                        if (listType === 'calendar' && obj.getEventsAfterDate) {
                            if (row.EventDate >= obj.getEventsAfterDate) eventArr.push(row); 
                        } else {
                            eventArr.push(row);
                        }

                    }
                }
                return eventArr;
            }
            return obj.listData;
        }

        String.prototype.formatInputToHours = function() {
            var amPmTime = this.split(' ');
            var hours = Number( amPmTime[0] );
            return (amPmTime[1] === 'PM' && hours < 12) ? hours += 12 : hours;
        }

        // this will grab date/time input values from a sharepoint form and convert them into proper date objects for later use.
        // by default this grabs the first and second date/time rows from a form.
        var convertFormDateTimes = function(row1, row2) {
            row1 = (!row1) ? 0 : row1;
            row2 = (!row2) ? 1 : row2;

            function findDateTimes(row) {
                var dtParentElem = document.querySelectorAll('input[id$="DateTimeField_DateTimeFieldDate"]')[row].parentNode.parentNode;
                var timeElem = dtParentElem.getElementsByClassName('ms-dttimeinput')[0];
                
                if (timeElem) {
                    var hours = timeElem.getElementsByTagName('select')[0].value;
                    var min = timeElem.getElementsByTagName('select')[1].value;
                }

                return {
                    date: dtParentElem.getElementsByTagName('td')[0].getElementsByTagName('input')[0].value,
                    time: function() {
                        return (hours && min) ? hours.formatInputToHours() + ':' + min : '';
                    },
                }
            }

            var beginDateTimes = findDateTimes(row1);
            var endDateTimes = findDateTimes(row2);

            return {
                userBeginDT: new Date( beginDateTimes.date + ' ' + beginDateTimes.time() ),
                userEndDT: new Date( endDateTimes.date + ' ' + endDateTimes.time() )
            }
        }


        // the main object we use.
        function SPCalendarPro(obj, listType) {
            this.listName = obj.listName;
            this.userDateTimes = {};
            this.SPInfo = getSPEnvInfo(obj.sourceSite);
            this.getEventsAfterDate = (obj.getEventsAfterDate) ? obj.getEventsAfterDate : false;
            this.fields = obj.fields ? obj.fields : null;
            
            this.listData = getListData(this, obj.async, obj.type, listType);

            this.callback = function() {
                return (obj.callback) ? obj.callback(this) : null;
            }

            return this;
        }

        var data = {
            getCalendarEvents: function(obj) {
                return new SPCalendarPro(obj, 'calendar');
            },
            
            getListItems: function(obj) {
                return new SPCalendarPro(obj, 'list');
            },

            getDateTimesFromForm: function(row1, row2) {
                var time = convertFormDateTimes(row1, row2);
                return formatDateTimesToObj( time.userBeginDT, time.userEndDT );
            },

            disableDragAndDrop: function() {
                ExecuteOrDelayUntilScriptLoaded(disableDragDrop, 'SP.UI.ApplicationPages.Calendar.js');
                function disableDragDrop() {
                    var calendarCreate = SP.UI.ApplicationPages.CalendarContainerFactory.create;
                    SP.UI.ApplicationPages.CalendarContainerFactory.create = function(elem, cctx, viewType, date, startupData) {
                        if (cctx.dataSources && cctx.dataSources instanceof Array && cctx.dataSources.length > 0) {
                            for (var i = 0; i < cctx.dataSources.length; i++) {
                                cctx.dataSources[i].disableDrag = true;
                            }
                        }
                        calendarCreate(elem, cctx, viewType, date, startupData);
                    }
                }
            },
            
        }

    return data;

}));