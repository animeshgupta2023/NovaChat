# NovaChat Change Log

This file records the main changes requested and implemented during the frontend/backend auth and chat-flow fixes.
## 4. Protected route guard

### What was changed
- Added route protection in `Frontend/src/App.jsx` so direct access to `/home` is blocked when the user is not authenticated.
- Protected routes now redirect unauthenticated users to the login page.

### Why it was needed
Users could open the app by typing `/home` directly into the browser even while logged out.

### How it was fixed
- Created a `ProtectedRoute` wrapper.
- Checked the local login flag before allowing access.
- Redirected to `/auth?mode=login` if access is denied.

---

## 5. Frontend session verification with backend

### What was changed
- Added a backend session-check route and frontend validation logic.
- The app now verifies that the Passport session still exists before allowing access to protected pages.

### Why it was needed
If the backend session is lost after a refresh or server restart, the frontend should not trust stale localStorage alone.

### How it was fixed
- Added `GET /auth/session` in `Backend/routes/user.js`.
- Implemented `getCurrentUser` in `Backend/controllers/Users.js`.
- The frontend sends a cookie-enabled request to `/auth/session` during app protection checks.
- If the session is invalid, it removes stale local data and redirects the user to auth.

---

## 6. User name and email display

### What was changed
- Stored the logged-in user data in context and localStorage.
- Displayed the username and email in the profile dropdown and sidebar.

### Why it was needed
The app previously fell back to “Guest” because the frontend was not reading the returned backend user payload properly.

### How it was fixed
- Updated the auth flow to save the returned `user` object from the backend.
- Distributed that value through the shared `MyContext`.
- Rendered the current user in:
  - the chat dropdown summary
  - the sidebar footer

---

## 7. Click-outside close for profile menu

### What was changed
- Added logic to close the profile dropdown when the user clicks anywhere outside of it.

### Why it was needed
The dropdown stayed open after users clicked elsewhere, which made the UI feel broken.

### How it was fixed
- Added `useRef` references for the dropdown and trigger button.
- Added a `mousedown` event listener to detect outside clicks.
- Closed the menu when the click happened outside both elements.

---

## 8. Sidebar refresh for first-thread creation

### What was changed
- Fixed the thread sidebar behavior so a newly created thread appears immediately after the first message.

### Why it was needed
The sidebar was only refreshing when the thread ID changed, not when the current thread’s message list changed.

### How it was fixed
- Added a dependency on `prevChats.length` in the sidebar refresh effect.
- Ensured the thread is saved to MongoDB immediately when the first message is added, before the LLM response completes.

This ensures the thread becomes visible in the sidebar right after the first query instead of waiting for the second one.

---

## 9. Backend session cookie requirements

### What was changed
- Added `credentials: "include"` to frontend fetch requests for authenticated endpoints.

### Why it was needed
Passport session auth depends on the session cookie being sent in browser requests.

### How it was fixed
- Added `credentials: "include"` to all requests that require auth, including:
  - chat API calls
  - thread list fetches
  - thread open/delete requests
  - logout requests

This resolved the unauthorized errors caused by missing session cookies.
