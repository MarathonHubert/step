var MainSearchView = Backbone.View.extend({
    el: ".search-form",
    events: {
        "click .find ": "search",
        "click .showStats": "showAnalysis"
    },
    //context items are of the form { itemType: x, value: y }
    specificContext: [],
    initialize: function () {
        var self = this;
        this.ignoreOpeningEvent = false;
        this.clearContextAfterSearch = false;
        this.masterSearch = this.$el.find("#masterSearch");
        this.specificContext = [];
        this.allContexts = [REFERENCE, VERSION, LIMIT, EXAMPLE_DATA];

        var view = this;
        _.bindAll(this);
        _.bindAll(view);
        this.listenTo(step.passages, "sync-update", this.syncWithUrl);
        this.listenTo(Backbone.Events, "search:add", this._appendVersions);
        this.listenTo(Backbone.Events, "search:remove", this._removeVersion);

        this.masterSearch.select2({
            minimumInputLength: 2,
            id: function (entry) {
                var id = entry.itemType + "-";
                switch (entry.itemType) {
                    case REFERENCE:
                        id += entry.item.fullName;
                        break;
                    case VERSION:
                        id += entry.item.shortInitials;
                        break;
                    case GREEK:
                    case GREEK_MEANINGS:
                    case HEBREW_MEANINGS:
                    case HEBREW:
                        //for these searches, we prevent multiple searches for the same strong number
                        //and therefore share an id.
                        id += entry.item.strongNumber;
                        break;
                    //some searches default to their item
                    case TEXT_SEARCH:
                    case SUBJECT_SEARCH:
                        id += (entry.item.searchTypes || []).join("-") + ":" + entry.item.value;
                        break;
                    case SYNTAX:
                        id += entry.value;
                        break;
                    case MEANINGS:
                        id += entry.item.gloss;
                        break;
                    case TOPIC_BY_REF:
                    case RELATED_VERSES:
                    default:
                        id += entry.item;
                        break;
                }
                return id;
            },
            formatInputTooShort: function (input, min) {

                var n = min - input.length;
                var message = sprintf(__s.x_more_characters, n, (n == 1 ? "" : __s.characters_plural));
                var labels = $("<span>").addClass("searchLabel")
                    .append($("<a>").attr("data-toggle", "modal").attr("data-target", "#bibleVersions").append(__s.all_versions).attr("title", __s.all_versions)
                        .on("click", function () {
                            view.pickBible();
                        })).append("&nbsp;|&nbsp;").append($("<a>").append(__s.search_advanced).on('click', function () {
                            view.openAdvancedSearch();
                        }));
                var container = $("<span>").append(labels).append($('<span class="message">').append(message));
                return  container;
            },
            ajax: {
                url: function (term, page) {
                    var url = SEARCH_AUTO_SUGGESTIONS + term;
                    var contextArgs = "";
                    if (self.specificContext.length != 0) {
                        for (var i = 0; i < self.specificContext.length; i++) {
                            contextArgs += self.specificContext[i].itemType + "=" + self.specificContext[i].value;
                            if (i < self.specificContext.length) {
                                contextArgs += '|';
                            }
                        }
                    }
                    
                    if(self.clearContextAfterSearch) {
                        self._removeSpecificContext(EXAMPLE_DATA);
                    }
                    
                    return url + "/" + encodeURIComponent(contextArgs);
                },
                dataType: "json",
                quietMillis: KEY_PAUSE,
                cache: true,
                results: function (data, page) {
                    var term = $.data(view.masterSearch.select2("container"), "select2-last-term");
                    var datum = [];
                    for (var ii = 0; ii < data.length; ii++) {
                        var itemAndText = view.convertResultTermToTypedOptions(data[ii], datum, term);

                        datum.push({
                            text: itemAndText.text,
                            item: itemAndText.item,
                            itemType: data[ii].itemType });
                    }
                    return { results: view.patch(datum, term) };
                }
            },

            multiple: true,
            formatResult: view.formatResults,
            matcher: view.matchDropdownEntry,
            /**
             * Formats the entry in the multi-select text input, once selected from the dropdown.
             * @param entry
             * @returns {*}
             */
            formatSelection: function (entry) {
                return step.util.ui.renderEnhancedToken(
                    entry, 
                    _.findWhere($("#masterSearch").select2("data"), { itemType: "version" }) == null
                );
            },
            escapeMarkup: function (m) {
                return m;
            },
            formatResultCssClass: view.formatResultCssClass,
            formatSelectionCssClass: view.formatResultCssClass
        }).on("select2-selecting", function (event) {
            var select2Input = $(this);
            if (event.object && event.object.itemType == REFERENCE && self._getSpecificContext(REFERENCE) == null &&
                (event.object.item.sectionType == 'BIBLE_BOOK' || event.object.item.sectionType == 'APOCRYPHA')
                ) {
                event.preventDefault();
                self._addSpecificContext(REFERENCE, event.object.item.shortName);

                //wipe the last term to force a re-select
                $.data(self.masterSearch.select2("container"), "select2-last-term", null);
                select2Input.select2("search", event.object.item.shortName);
            } else if (event.object.item.grouped) {
                event.preventDefault();
                $.data(self.masterSearch.select2("container"), "select2-last-term", null);
                self._addSpecificContext(LIMIT, event.object.itemType);
                select2Input.select2("search", self.getCurrentInput());
                select2Input.select2("container").find("input").focus();
            } else if(event.object.item.exit) {
                //exiting, so clear limit context
                event.preventDefault();
                self._removeSpecificContext(LIMIT);
                $.data(self.masterSearch.select2("container"), "select2-last-term", null);
                select2Input.select2("search", self.getCurrentInput());
            }
            return;
        }).on("selected", function(event) {
            //if we're replacing an item, then remove it
            var container = self.masterSearch.select2("container");
            var replaceItem = container.find(".replaceItem");
            var replaceItemParent = replaceItem.parent().parent().first();
            var newItem;
            if(replaceItemParent.length > 0) {
                var replaceItemIndex = replaceItemParent.index();
                var data = self.masterSearch.select2("data"); 
                data.splice(replaceItemIndex, 1, data[data.length -1]);
                self._setData(data);
                
                //if we resort to the 'data' method, we lose all our handlers
                newItem = container.find("[data-select-id]");
            } else {
                newItem = container.find("[data-select-id]").last();
            }
            
            //now get rid of all .replaceItems
            self._resetReplaceItems();
            
            //get last item in list
            var select2Input = $(this);
            var values = select2Input.select2("data") || [];
            if(values.length == 0) {
                return;
            }
            
            view._addTokenHandlers(newItem);
        }).on("select2-opening", function (event) {
            //remove any context that has references
            if (!self.ignoreOpeningEvent) {
                self._removeSpecificContext(self.allContexts);
                self._resetReplaceItems();
            }

            //add the first version selected to the context
            var data = self.masterSearch.select2("data") || [];
            for (var i = 0; i < data.length; i++) {
                if (data[i].itemType == VERSION) {
                    self._addSpecificContext(VERSION, data[i].item.initials);
                    break;
                }
            }
        }).on("select2-removed", function() {
            //re-evaluate master version
            self._reEvaluateMasterVersion();
        });

        this.masterSearch.select2("container")
            .find("input[type='text']").on("keyup", this._handleKeyPressInSearch);
    },
    _setData: function(values) {
        this.masterSearch.select2("data", values, this._addTokenHandlers);  
    },
    _resetReplaceItems: function() {
        this.masterSearch.select2("container").find(".replaceItem").removeClass("replaceItem"); 
    },
    _addTokenHandlers: function(tokenElement) {
        var tokens;
        if(tokenElement) {
            tokens = tokenElement;   
        } else {
            tokens = $("[data-select-id]");
        }
        
        this._addVersionHandlers(tokens);
        this._addReferenceHandlers(tokens);
        this._addDefaultExampleHandlers(tokens);
        this._addTextHandlers(tokens);
    },
    _addVersionHandlers: function(tokens) {
        var self = this;
        $(tokens).filter(".versionItem").click(function(ev) {
            self._markItemForReplacing(ev, $(this));
            self.pickBible();
        });
    },
    _addTextHandlers: function(tokens) {
        var self = this;
        $(tokens).filter(".textItem, syntaxItem").click(function(ev) {
            self._markItemForReplacing(ev, $(this));
            self.openAdvancedSearch($(this).hasClass("textItem") ? TEXT_SEARCH : SYNTAX);
        });
    },
    _addReferenceHandlers: function(tokens) {
        var self = this;
        $(tokens).filter(".referenceItem").each(function() {
            $(this).click(function(ev) {
            self._markItemForReplacing(ev, $(this));
            self._searchExampleData(ev, REFERENCE, null);
            })
        });
    },
    _addDefaultExampleHandlers: function(tokens) {
        var self = this;
        $(tokens).filter(".greekMeaningsItem, .hebrewMeaningsItem, .hebrewItem, .greekItem, .meaningsItem, .subjectItem").click(function(ev) {
            self._markItemForReplacing(ev, $(this));
            self._searchExampleData(ev, $(this).attr("data-item-type"), $(this).attr("data-select-id"));
        });
    },
    _searchExampleData: function(ev, itemType, term) {
        ev.stopPropagation();

        //fudge the search
        if(term == null) {
            term = "  ";
        }
        
        this.ignoreOpeningEvent = true;
        this.clearContextAfterSearch = true;

        this._addSpecificContext(EXAMPLE_DATA, itemType);
        this._addSpecificContext(LIMIT, itemType);
        $.data(this.masterSearch.select2("container"), "select2-last-term", null);
        this.masterSearch.select2("open");
        this.masterSearch.select2("search", term);
        this.ignoreOpeningEvent = false;
    },
    openAdvancedSearch: function(initialView) {
        var self = this;
        require(["menu_extras", "defaults"], function () {
            //find master version
            var dataItems = self.masterSearch.select2("data");
            var masterVersion = REF_VERSION;
            for (var i = 0; i < dataItems; i++) {
                if (dataItems[i].itemType == VERSION) {
                    masterVersion = dataItems[i].item.initials;
                    break;
                }
            }

            new AdvancedSearchView({ searchView: self, masterVersion: masterVersion, intialView: initialView });
        });  
    },
    /**
     * marks the item for deletion when a new item is selected
     * @param el the item to be marked
     * @private
     */
    _markItemForReplacing: function(ev, el) {
        if(!ev.shiftKey) {
            el.closest("ul").find(".replaceItem").removeClass("replaceItem");
            el.addClass("replaceItem");
        }
    },
    pickBible: function() {
        var self = this;
        require(["menu_extras", "defaults"], function () {
            new PickBibleView({ model: step.settings, searchView: self });
        });
    },
    convertResultTermToNormalOption: function (termSuggestion, datum) {
        var text = termSuggestion;
        var item = termSuggestion;


        //will never be a SYNTAX autocompletion? search, so not in the list below
        switch (termSuggestion.itemType) {
            case HEBREW:
            case GREEK:
                text = this._getAncientFirstRepresentation(termSuggestion.suggestion, termSuggestion.itemType == HEBREW);
                break;
            case GREEK_MEANINGS:
            case HEBREW_MEANINGS:
                text = this._getEnglishFirstRepresentation(termSuggestion.suggestion, termSuggestion.itemType == HEBREW_MEANINGS);
                break;
            case REFERENCE:
                //for a reference that is a whole book, we push an extra one in
                text = termSuggestion.suggestion.fullName;
                item = termSuggestion;
                break;
            case SUBJECT_SEARCH:
                text = termSuggestion.suggestion.value;
                break;
            case TEXT_SEARCH:
                text = termSuggestion.suggestion.text;
                break;
        }

//        console.log(termSuggestion.itemType, termSuggestion, text, item.suggestion);
        return {text: text, item: item.suggestion };
    },
    convertResultToGroup: function (item, term) {
        var returnedItem = item;
        this.setGroupText(returnedItem, term);

        return { text: returnedItem.text, item: returnedItem };
    },
    convertResultTermToTypedOptions: function (termSuggestion, datum, term) {
        if (termSuggestion.grouped) {
            return this.convertResultToGroup(termSuggestion, term);
        }

        return this.convertResultTermToNormalOption(termSuggestion, datum);
    },
    setGroupText: function (item, term) {
        var exampleTokens = [];
        var examples = item.extraExamples || [];
        for(var i = 0; i < examples.length; i++) {
            switch(item.itemType) {
                case HEBREW: 
                case GREEK: 
                    exampleTokens.push(this._markMatch(examples[i].stepTransliteration, term));
                    break;
                case HEBREW_MEANINGS: 
                case GREEK_MEANINGS: 
                case MEANINGS: 
                    exampleTokens.push(this._markMatch(examples[i].gloss, term));
                    break;
                case SUBJECT_SEARCH:
                    exampleTokens.push(this._markMatch(examples[i].value, term));
                    break;
                case VERSION: 
                    exampleTokens.push(this._markMatch(examples[i].item.initials, term));
                    break;
            }
            
            if(exampleTokens.length >= 2) {
                break;
            }
        }
        
        var exampleText = exampleTokens.join(", ");
        
        item.text = sprintf(__s.options_number_of_terms, exampleText);
    },

    _getAncientFirstRepresentation: function (item, hebrew, term) {
        return '<span class="' + (hebrew ? 'hbFontMini' : 'unicodeFontMini') + '">' + 
            item.matchingForm + "</span> (" + this._markMatch(item.stepTransliteration, term) + " - " + this._markMatch(item.gloss, term) + ")";
    },
    _getEnglishFirstRepresentation: function (item, hebrew, term) {
        return this._markMatch(item.gloss, term) + " (" + this._markMatch(item.stepTransliteration, term) + " - " + '<span class="' + (hebrew ? 'hbFontMini' : 'unicodeFontMini') + '">' + item.matchingForm + "</span>)";
    },
    _getCurrentInitials: function () {
        var data = this.masterSearch.select2("data");
        var initials = [];
        for (var i = 0; i < data.length; i++) {
            initials.push(data[i].item.shortInitials);
        }
        return initials;
    },
    _appendVersions: function (data) {
        var originalData = this.masterSearch.select2("data");
        originalData.push({ item: data.value, itemType: data.itemType});
        this._setData(originalData);
    },
    _removeVersion: function (data) {
        //find the element
        var versions = this.masterSearch.select2("data");
        for (var i = 0; i < versions.length; i++) {
            if (versions[i].item.initials == data.value.initials || versions.shortInitials == data.value.initials) {
                versions.splice(i, 1);
                i--;
            }
        }
        this._setData(versions);
    },
    search: function () {
        console.log("Searching...");
        var options = this.masterSearch.select2("data");
        var args = "";
        for (var ii = 0; ii < options.length; ii++) {
            if (args.length != 0) {
                args += "|";
            }

            switch (options[ii].itemType) {
                case VERSION:
                    args += options[ii].itemType + "=";
                    args += encodeURIComponent(options[ii].item.shortInitials);
                    break;
                case REFERENCE:
                    args += options[ii].itemType + "=";
                    args += encodeURIComponent(options[ii].item.shortName);
                    break;
                case GREEK:
                case GREEK_MEANINGS:
                case HEBREW:
                case HEBREW_MEANINGS:
                    args += STRONG_NUMBER + "=" + encodeURIComponent(options[ii].item.strongNumber);
                    break;
                case MEANINGS:
                    args += MEANINGS + "=" + encodeURIComponent(options[ii].item.gloss);
                    break;
                case SUBJECT_SEARCH:
                    var lastSelection = step.util.activePassage().get("subjectSearchType");
                    var selectedSubjectSearchType = "";
                    var previouslySelectedIndex = options[ii].item.searchTypes.indexOf(lastSelection);
                    if (previouslySelectedIndex != -1) {
                        //use the last selection
                        selectedSubjectSearchType = options[ii].item.searchTypes[previouslySelectedIndex];
                    } else {
                        //use the first item
                        selectedSubjectSearchType = options[ii].item.searchTypes[0];
                    }

                    switch (selectedSubjectSearchType) {
                        case "SUBJECT_SIMPLE":
                            args += SUBJECT_SEARCH;
                            break;
                        case "SUBJECT_EXTENDED":
                            args += NAVE_SEARCH;
                            break;
                        case "SUBJECT_FULL":
                            args += NAVE_SEARCH_EXTENDED;
                            break;
                        default:
                            args += options[ii].itemType + "=" + encodeURIComponent(options[ii].item);
                    }
                    args += "=" + encodeURIComponent(options[ii].item.value);
                    break;
                case TOPIC_BY_REF:
                case RELATED_VERSES:
                    args += options[ii].itemType + "=" + encodeURIComponent(options[ii].item.text);
                    break;
                case SYNTAX:
                    args += options[ii].itemType + "=" + encodeURIComponent(options[ii].item.value);
                    break;
                case TEXT_SEARCH:
                    args += options[ii].itemType + "=" + encodeURIComponent(options[ii].item.text);
                    break;
                default:
                    args += options[ii].itemType + "=" + encodeURIComponent(options[ii].item);
                    break;
            }
        }

        //reset defaults:
        step.util.activePassage().save({ pageNumber: 1, filter: null, strongHighlights: null }, { silent: true});
        console.log("Arguments are: ", args);
        step.router.navigateSearch(args);
    },
    getCurrentInput: function () {
        return this.masterSearch.select2("container").find(".select2-input").val();
    },
    patch: function (results, term) {
        //check we don't have a limit:
        var includeEverything = true;
        var limit = (_.findWhere(this.specificContext, { itemType: LIMIT }) || {}).value;

        //splice in the 'exit' item
        if(limit) {
            var item = { itemType: limit, item: { exit: true  }};
            results.splice(0,0, item);
        }
        
        //then patch in the versions and other data if need be.
        var staticResources = [];
        if (limit == null) {
            staticResources = this._getData(null, term);
            //push some of the options that are also always present:
        } else if(limit == VERSION) {
            staticResources = this._getData(limit, term);
        }
        
        //find last version and re-order that section
        var i = 0;
        for(i = 0; i < results.length; i++) {
            if(results[i].itemType != REFERENCE) {
                break;
            }
        }
        
        var firstPart = results.slice(0, i);
        var secondPart = results.slice(i);
        return firstPart.concat(staticResources).concat(secondPart);
    },
    _getData: function (limit, term) {
        return this.filterLocalData(limit, term);
    },
    matchDropdownEntry: function (term, textOrObject) {
        if (step.util.isBlank(textOrObject)) {
            return false;
        }

        var regex = new RegExp("\\b" + term, "ig");
        if ($.type(textOrObject) === "string") {
            return textOrObject != null && textOrObject != "" && textOrObject.toLowerCase().match(regex);
        }

        switch (textOrObject.itemType) {
            case VERSION:
                var matches = this.matchDropdownEntry(term, textOrObject.item.name || "") ||
                    this.matchDropdownEntry(term, textOrObject.item.languageName || "");
                return matches;
            case GREEK_MEANINGS:
            case HEBREW_MEANINGS:
                return this.matchDropdownEntry(term, textOrObject.item.gloss);
            case GREEK:
            case HEBREW:
                return this.matchDropdownEntry(term, textOrObject.item.stepTransliteration) ||
                    this.matchDropdownEntry(term, textOrObject.item.matchingForm) ||
                    this.matchDropdownEntry(term, textOrObject.item.strongNumber);
            case SUBJECT_SEARCH:
                return this.matchDropdownEntry(term, textOrObject.item.value);
            case TEXT_SEARCH:
                return this.matchDropdownEntry(term, textOrObject.item.text);
        }
        return false;
    },
    _addSpecificContext: function (itemType, value) {
        this._removeSpecificContext(itemType);
        this.specificContext.push({ itemType: itemType, value: value });
    },
    _getSpecificContext: function(itemType) {
        return (_.findWhere(this.specificContext, { itemType: itemType }) || {}).value;
    },
    /**
     * Removes all contexts of a particular type
     * @param itemType the item type, or array of item types
     * @private
     */
    _removeSpecificContext: function (itemType) {
        if (itemType == null) {
            itemType = [];
        } else if (!$.isArray(itemType)) {
            itemType = [itemType];
        }

        for (var i = 0; i < this.specificContext.length; i++) {
            if (itemType.indexOf(this.specificContext[i].itemType) != -1) {
                this.specificContext.splice(i, 1);
                //i will be incremented, so keep it in sync with for loop increment
                i--;
            }
        }
    },
    filterLocalData: function (limit, term) {
        var options = [];

        //we will only add stuff if there is no specific context around references
        for (var i = 0; i < this.specificContext.length; i++) {
            if (this.specificContext[i].itemType == REFERENCE) {
                return options;
            }
        }

        var currentInput = (this.getCurrentInput() || "").toLowerCase();
        var exactInitials = [];
        var prefixInitials = [];
        var languageMatches = [];
        var recommendedByLanguage = [];
        var others = [];

        var totalNotDisplayed = 0;
        for (var ii = 0; ii < step.itemisedVersions.length; ii++) {
            var currentVersion = step.itemisedVersions[ii];
            var shortName = (currentVersion.item.shortInitials || "").toLowerCase();
            var initials = (currentVersion.item.initials || "").toLowerCase();
            var languageName = (currentVersion.item.languageName || "").toLowerCase();
            
            if ((initials != "" && initials == currentInput) || (shortName != "" && shortName == currentInput)) {
                exactInitials.push(currentVersion);
            } else if (shortName.startsWith(currentInput) || initials.startsWith(currentInput)) {
                prefixInitials.push(currentVersion);
            } else if(languageName.startsWith(currentInput)) {
                if(currentVersion.item.recommended) {
                    recommendedByLanguage.push(currentVersion);
                } else {
                    languageMatches.push(currentVersion);
                }
            } else if (this.matchDropdownEntry(currentInput, currentVersion)) {
                if (limit == VERSION || exactInitials.length + prefixInitials.length < 3) {
                    others.push(step.itemisedVersions[ii]);
                } else {
                    totalNotDisplayed++;
                }
            }
        }

        options = options.concat(exactInitials);
        options = options.concat(prefixInitials);
        //make sure language matches are before other matches on description and such like
        others = recommendedByLanguage.concat(languageMatches).concat(others);

        if(limit == VERSION) {
            options = options.concat(others);
        } else if (options.length < 3) {
            totalNotDisplayed = others.length - 3;
            options = options.concat(others.splice(0, 3 - options.length));
        }

        if (totalNotDisplayed > 0) {
            var groupedItem = {  itemType: VERSION, item: {}, grouped: true, 
                count: totalNotDisplayed, maxReached: false, extraExamples: others.splice(0,2) };
            this.setGroupText(groupedItem, term);
            options.push( { text: groupedItem.text, item: groupedItem, itemType: VERSION });
        }

        return options;
    },
    formatResultCssClass: function (item) {
        return "select-" + item.itemType;
    },
    
    /**
     * Renders the view when shown in the dropdown list
     *
     * @param v the item we are rendering
     * @param container
     * @param query
     * @param escapeMarkup
     * @returns {string}
     */
    formatResults: function (v, container, query, escapeMarkup) {
        var source = step.util.ui.getSource(v.itemType);
        var row;

        if (v.item.grouped) {
            return "<span class='glyphicon glyphicon-chevron-down'></span> " + source + v.item.text;
        }
        
        if(v.item.exit) {
            //this is an exit instruction, so simply add something with the right icon
            return "<span class='glyphicon glyphicon-chevron-up'></span> " + __s.exit_dropdown;
        }

        switch (v.itemType) {
            case VERSION:
                row = [
                    '<div class="versionItem">',
                    source,
                        '<span class="features">' + step.util.ui.getFeaturesLabel(v.item) + '</span>',
                        '<span class="initials">' + this._markMatch(v.item.shortInitials, query.term) + '</span> - ',
                        '<span class="name">' + this._markMatch(v.item.name, query.term) + '</span>',
                    '</div>'
                ].join('');
                break;
            case GREEK:
                row = source + this._getAncientFirstRepresentation(v.item, false, query.term);
                break;
            case GREEK_MEANINGS:
                row = source + this._getEnglishFirstRepresentation(v.item, false, query.term);
                break;
            case HEBREW:
                row = source + this._getAncientFirstRepresentation(v.item, true, query.term);
                break;
            case HEBREW_MEANINGS:
                row = source + this._getEnglishFirstRepresentation(v.item, true, query.term);
                break;
            case REFERENCE:
                var internationalisedSectionName;
                if(v.item.sectionType == 'BIBLE_BOOK' && this._getSpecificContext(REFERENCE) != null) {
                    //then we are listing all chapters, and should display 'Whole book' instead
                    internationalisedSectionName = __s.bible_whole_book_section;
                } else {
                    internationalisedSectionName = __s[v.item.sectionType.toLowerCase() + "_section"];
                }
                row = ['<span class="source">[' + internationalisedSectionName + ']</span>',
                    this._markMatch(v.item.fullName, query.term)
                ].join('');
                break;
            case TEXT_SEARCH:
                row = [source,
                    this._markMatch(v.item.text, query.term)
                ].join('');
                break;
            case SUBJECT_SEARCH:
                var features = "";

                for (var i = 0; i < v.item.searchTypes.length; i++) {
                    switch (v.item.searchTypes[i]) {
                        case 'SUBJECT_SIMPLE':
                            features += '<span title="' + __s.search_subject_book_headings + '">' + __s.search_subject_book_headings_initials + '</span> ';
                            break;
                        case 'SUBJECT_EXTENDED':
                            features += '<span title="' + __s.search_subject_nave + '">' + __s.search_subject_nave_initials + '</span> ';
                            break;
                        case 'SUBJECT_FULL':
                            features += '<span title="' + __s.search_subject_nave_extended + '">' + __s.search_subject_nave_extended_initials + '</span> ';
                            break;
                    }
                }
                row = source + '<span class="features">' + features + '</span>' + this._markMatch(v.item.value, query.term) + '</div>';
                break;
            case MEANINGS:
                row = source + this._markMatch(v.item.gloss, query.term);
                break;
            case SYNTAX:
                row = source + this._markMatch(v.item.value, query.term);
                break;
        }
        return row;
    },
    _markMatch: function(text, term) {
        if(text == null || term == null || text.length == 0 || term.length == 0) {
            return text;
        }
        
        var cleansedText = window.Select2.util.stripDiacritics(text.toLowerCase());
        var cleansedTerm = window.Select2.util.stripDiacritics(term.toLowerCase());
        
        var start = cleansedText.indexOf(cleansedTerm);
        if(start != -1) {
            return text.substring(0, start) + 
                '<span class="select2-match">' + text.substring(start, start + term.length ) + '</span>' + 
                text.substring(start + term.length);
        }
        return text;
    },
    _getPartialToken: function (initialData, tokenItem) {
        var tokenType = tokenItem.tokenType;
        var token = tokenItem.token || "";
        var enhancedInfo = tokenItem.enhancedTokenInfo;

        switch (tokenType) {
            case VERSION:
                return step.keyedVersions[token];
            case REFERENCE:
                return { fullName: enhancedInfo.fullName, shortName: enhancedInfo.shortName };
            case GREEK_MEANINGS:
            case GREEK:
            case HEBREW_MEANINGS:
            case HEBREW:
            case STRONG_NUMBER:
                //we need to work out what kind of type this was before
                for (var ii = 0; ii < initialData.length; ii++) {
                    var previousType;
                    if (initialData[ii].item && initialData[ii].item.strongNumber == token) {
                        //we're a winner
                        tokenItem.tokenType = initialData[ii].itemType;
                    }
                }

                //else default to something (in the future, we may change the URLs
                if (token.length > 0 && token[0] == 'G') {
                    tokenItem.tokenType = GREEK_MEANINGS;
                } else {
                    tokenItem.tokenType = HEBREW_MEANINGS;
                }

                return enhancedInfo;
            case SUBJECT_SEARCH:
                return { value: token, searchTypes: ["SUBJECT_SIMPLE"] };
            case NAVE_SEARCH:
                return { value: token, searchTypes: ["SUBJECT_EXTENDED"] };
            case NAVE_SEARCH_EXTENDED:
                return { value: token, searchTypes: ["SUBJECT_FULL"] };
            case TOPIC_BY_REF:
            case RELATED_VERSES:
                return { text: token };
            case MEANINGS:
                return { gloss: token };
            case TEXT_SEARCH:
            case SYNTAX:
                return enhancedInfo == null ? {text: "&lt;...&gt;", value: token} : {text: enhancedInfo, value: "&lt;" + enhancedInfo + "...&gt;"};
            default:
                return token;
        }
    },
    _reconstructToken: function (initialData, tokens, i) {
        var item = this._getPartialToken(initialData, tokens[i]);
        var tokenType = tokens[i].tokenType;
        switch (tokenType) {
            case SUBJECT_SEARCH:
            case NAVE_SEARCH:
            case NAVE_SEARCH_EXTENDED:
                tokenType = SUBJECT_SEARCH;
                break;
        }

        return { item: item, itemType: tokenType };
    },
    syncWithUrl: function (model) {
        if (model == null) {
            model = step.util.activePassage();
        }

        var initialData = this.masterSearch.select2("data");

        //overwrite all the data
        var data = [];
        var tokens = model.get("searchTokens") || [];
        for (var i = 0; i < tokens.length; i++) {
            //check if the tokens are in the search box already... if so, then don't add them
            data.push(this._reconstructToken(initialData, tokens, i));
        }
        this._setData(data);
        this._addTokenHandlers();
    },
    _handleKeyPressInSearch: function (ev) {
        if (ev.keyCode == 13) {
            //check whether the container is open
            if ($(".select2-result-selectable").length == 0) {
                // trigger search
                this.search();
            }
        }
    },
    showAnalysis: function () {
        //trigger side bar
        require(["sidebar"], function (module) {
            //read up on requirejs to see if init can form part of download call
            step.util.ui.initSidebar();
        });
    },
    _reEvaluateMasterVersion: function() {
        var masterVersion = this.$el.find(".versionItem").eq(0);
        if(masterVersion.length > 0 && !masterVersion.hasClass("masterVersion")) {
            masterVersion.addClass("masterVersion");
            masterVersion.attr("title", masterVersion.attr("title") + "\n" + __s.master_version_info);
        }
    }
});