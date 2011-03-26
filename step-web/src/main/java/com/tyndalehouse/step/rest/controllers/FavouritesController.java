package com.tyndalehouse.step.rest.controllers;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

import org.apache.commons.lang.StringUtils;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.tyndalehouse.step.core.data.entities.Bookmark;
import com.tyndalehouse.step.core.data.entities.History;
import com.tyndalehouse.step.core.exceptions.StepInternalException;
import com.tyndalehouse.step.core.service.FavouritesService;

/**
 * This helps manage bookmarks and history items. This implementation simply wraps around the Favourites
 * Service (the project step-web provides a WebSessionProvider which can be used therefore to get cookie
 * information).
 * 
 * In this case, we just simply proxy through
 * 
 * @author Chris
 * 
 */
@Singleton
public class FavouritesController {
    private final FavouritesService favouritesService;

    /**
     * We simply inject the bookmark service and proxy requests through
     * 
     * @param bookmarkService the bookmark service used to get our data
     */
    @Inject
    public FavouritesController(final FavouritesService bookmarkService) {
        this.favouritesService = bookmarkService;
    }

    /**
     * gets a set of bookmarks associated with the current session
     * 
     * @return a list of bookmarks
     */
    public List<Bookmark> getBookmarks() {
        return this.favouritesService.getBookmarks();
    }

    /**
     * Removes a bookmark, using the current session-ed and logged on user
     * 
     * @param bookmarkId the bookmark id to use.
     */
    public void removeBookmark(final int bookmarkId) {
        this.favouritesService.removeBookmark(bookmarkId);
    }

    /**
     * Adds a bookmark if not already there
     * 
     * @param reference the reference to add to the bookmark
     * @return the id of the bookmark that was added
     */
    public int addBookmark(final String reference) {
        return this.favouritesService.addBookmark(reference);
    }

    /**
     * The encoding might be client specific, so we first decode the information sent, and then pass it
     * through into a list of objects
     * 
     * @param clientHistoryString the string as passed by the UI of the current cookie contents
     * @return all the history items to the UI, merged with the client history as appropriate
     */
    public List<History> getHistory(final String clientHistoryString) {
        final List<History> clientHistory = new ArrayList<History>();

        // check for no history - currently a bit of a hack
        if (StringUtils.isNotEmpty(clientHistoryString) && !"null".equals(clientHistoryString)) {

            // first we split by '#' to get individual portions of the history list
            // then by @ sign to get the date at which they were last updated
            // we will do a fairly gross approximation here and refactor if this causes issues
            try {
                final String[] tokens = StringUtils.split(clientHistoryString, "~@");
                for (int ii = 0; ii < tokens.length; ii = ii + 2) {
                    final History item = new History();
                    item.setHistoryReference(tokens[ii]);
                    item.setLastUpdated(new Timestamp(Long.parseLong(tokens[ii + 1])));
                    clientHistory.add(item);
                }
            } catch (final NumberFormatException e) {
                throw new StepInternalException("Unable to parse stored history", e);
            }
        }
        return this.favouritesService.getHistory(clientHistory);
    }

    /**
     * adds or updates the history item
     * 
     * @param reference the reference to be checked and added/updated
     * @return the id of the reference
     */
    public int addHistory(final String reference) {
        final String[] split = StringUtils.split(reference, '@');
        if (split.length != 2) {
            throw new StepInternalException("Unable to add history item to user profile.");
        }

        return this.favouritesService.addHistory(split[0], new Timestamp(Long.valueOf(split[1])));
    }
}
