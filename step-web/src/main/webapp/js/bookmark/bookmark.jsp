<%@page import="javax.servlet.jsp.jstl.core.Config"%>
<%@ page pageEncoding="UTF-8" %>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt" %>

<% if(request.getParameter("lang") != null) {
	Config.set(session, Config.FMT_LOCALE, request.getParameter("lang"));
} else { 
	Config.set(session, Config.FMT_LOCALE, request.getLocale().getLanguage());
} %>

<fmt:setBundle basename="HtmlBundle" />


<div class="bookmarks" id="centerPane">
	<div class="northBookmark">
		<img id="topLogo" src="images/step-logo.png"
			alt="STEP :: Scripture Tools for Every Person" />
	</div>
	<div id="bookmarkPane" class="bookmarkPane ui-corner-all expandable">
		<h3 class="ui-helper-reset ui-state-default ui-corner-all">
			<span class="leftBookmarkArrow ui-icon ui-icon-triangle-1-e"></span><fmt:message key="recent_texts" />
		</h3>
		<div id="historyDisplayPane" class="bookmarkContents">
			<br />
		</div>
		<h3 id="bookmarkHeader"
			class="ui-helper-reset ui-state-default ui-corner-all expandable">
			<span class="leftBookmarkArrow ui-icon ui-icon-triangle-1-e"></span><fmt:message key="bookmarks" />
		</h3>
		<div id="bookmarkDisplayPane" class="bookmarkContents">
			<br />
		</div>
	</div>
	<div class="logo">
		<span class="copyright">&copy; Tyndale House</span>
	</div>
</div>