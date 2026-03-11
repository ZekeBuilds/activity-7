// js/app.js
// SocialNet Manager — LBYCPG3 Activity 7
// All Supabase CRUD logic and DOM rendering

// ================================================================
// Section 1: Supabase Client Initialization
// ================================================================
// The `supabase` global is provided by the CDN script in index.html.
const { createClient } = supabase

const SUPABASE_URL            = 'https://lngxhwcofrjgwftwuhcp.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CZgQ6fi_TKSsjFlYPuZYjQ_rGZ69_HY'

const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

// ================================================================
// Section 2: Application State
// ================================================================
// currentProfileId holds the UUID of the profile currently shown
// in the centre panel. null = no profile selected.
let currentProfileId = null

// ================================================================
// Section 3: Helper / DOM Functions
// ================================================================

/**
 * setStatus(message, isError)
 * Displays a message in the status bar at the bottom of the page.
 * Red background on error, default navy on success.
 */
function setStatus(message, isError = false) {
  const msgEl   = document.getElementById('status-message')
  const footer  = document.getElementById('status-bar')
  const dot     = document.getElementById('status-dot')

  msgEl.textContent = message
  footer.style.background = isError ? '#6b1a1a' : 'var(--clr-status-bg)'
  footer.style.color      = isError ? '#ffcccc' : 'var(--clr-status-text)'
  if (dot) dot.style.color = isError ? '#e87070' : '#4cba84'
}

/**
 * clearCentrePanel()
 * Resets the centre panel to its default empty state.
 * Called after a profile is deleted or when a search returns nothing.
 */
function clearCentrePanel() {
  document.getElementById('profile-pic').src            = 'resources/images/default.svg'
  document.getElementById('profile-name').textContent   = 'No Profile Selected'
  document.getElementById('profile-status').textContent = '—'
  document.getElementById('profile-quote').textContent  = '—'
  document.getElementById('friends-list').innerHTML     = '<p class="empty-state">No profile selected.</p>'
  currentProfileId = null
}

/**
 * displayProfile(profile, friends)
 * Renders a profile object and its friends array into the centre panel.
 *   profile: row object from the profiles table
 *   friends: array of {id, name} objects
 */
function displayProfile(profile, friends = []) {
  const pic = profile.picture || 'resources/images/default.svg'
  document.getElementById('profile-pic').src            = pic
  document.getElementById('profile-name').textContent   = profile.name
  document.getElementById('profile-status').textContent = profile.status || '(no status)'
  document.getElementById('profile-quote').textContent  = profile.quote  || '(no quote)'
  currentProfileId = profile.id
  renderFriendsList(friends)
  setStatus(`Displaying ${profile.name}.`)
}

/**
 * renderFriendsList(friends)
 * Builds the friends list HTML inside the centre panel.
 * Each element of friends is expected to have a .name property.
 */
function renderFriendsList(friends) {
  const list = document.getElementById('friends-list')
  list.innerHTML = ''

  if (!friends || friends.length === 0) {
    list.innerHTML = '<p class="empty-state">No friends yet.</p>'
    return
  }

  friends.forEach(f => {
    const div = document.createElement('div')
    div.className   = 'friend-entry'
    div.textContent = f.name
    list.appendChild(div)
  })
}

// ================================================================
// Section 4: CRUD — Profile List
// ================================================================

/**
 * loadProfileList()
 * Fetches all profiles (id, name) sorted alphabetically and
 * renders them as clickable rows in the left panel.
 */
async function loadProfileList() {
  try {
    const { data, error } = await db
      .from('profiles')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) throw error

    const container = document.getElementById('profile-list')
    container.innerHTML = ''

    if (data.length === 0) {
      container.innerHTML = '<p class="empty-state">No profiles found.</p>'
      return
    }

    data.forEach(profile => {
      const row = document.createElement('div')
      row.className  = 'profile-item'
      row.dataset.id = profile.id

      // Initials bubble
      const initial = document.createElement('span')
      initial.className   = 'profile-initial'
      initial.textContent = profile.name.charAt(0).toUpperCase()
      initial.setAttribute('aria-hidden', 'true')

      // Name text
      const nameSpan = document.createElement('span')
      nameSpan.textContent = profile.name

      row.appendChild(initial)
      row.appendChild(nameSpan)
      row.addEventListener('click', () => selectProfile(profile.id))
      container.appendChild(row)
    })

    // Re-highlight the active profile after list reload
    if (currentProfileId) {
      document.querySelectorAll('#profile-list .profile-item')
        .forEach(el => el.classList.toggle('active', el.dataset.id === currentProfileId))
    }
  } catch (err) {
    setStatus(`Error loading profiles: ${err.message}`, true)
  }
}

/**
 * selectProfile(profileId)
 * Fetches the full profile row + bidirectional friend list,
 * highlights the row in the left panel, and renders to centre panel.
 */
async function selectProfile(profileId) {
  try {
    // Highlight active row
    document.querySelectorAll('#profile-list .profile-item')
      .forEach(el => el.classList.toggle('active', el.dataset.id === profileId))

    // Fetch full profile row
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()

    if (profileError) throw profileError

    // Fetch all friendship rows for this profile (either column)
    const { data: friendRows, error: friendsError } = await db
      .from('friends')
      .select('profile_id, friend_id')
      .or(`profile_id.eq.${profileId},friend_id.eq.${profileId}`)

    if (friendsError) throw friendsError

    // Extract the UUIDs of the other side of each friendship
    const friendIds = friendRows.map(row =>
      row.profile_id === profileId ? row.friend_id : row.profile_id
    )

    // Resolve UUIDs to names with a second query
    let friends = []
    if (friendIds.length > 0) {
      const { data: friendProfiles, error: fpError } = await db
        .from('profiles')
        .select('id, name')
        .in('id', friendIds)
        .order('name', { ascending: true })

      if (fpError) throw fpError
      friends = friendProfiles
    }

    displayProfile(profile, friends)
  } catch (err) {
    setStatus(`Error selecting profile: ${err.message}`, true)
  }
}

// ================================================================
// Section 4b: CRUD — Add / Lookup / Delete
// ================================================================

/**
 * addProfile()
 * Reads the name input, validates, inserts a new row, then selects it.
 * Handles Postgres unique-violation (code 23505) with a targeted message.
 */
async function addProfile() {
  const nameInput = document.getElementById('input-name')
  const name = nameInput.value.trim()

  if (!name) {
    setStatus('Error: Name field is empty. Please enter a name.', true)
    return
  }

  try {
    const { data, error } = await db
      .from('profiles')
      .insert({ name })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        setStatus(`Error: A profile named "${name}" already exists.`, true)
      } else {
        throw error
      }
      return
    }

    nameInput.value = ''
    await loadProfileList()
    await selectProfile(data.id)
    setStatus(`Profile "${name}" created successfully.`)
  } catch (err) {
    setStatus(`Error adding profile: ${err.message}`, true)
  }
}

/**
 * lookUpProfile()
 * Case-insensitive partial name search. Selects the first match.
 */
async function lookUpProfile() {
  const query = document.getElementById('input-name').value.trim()

  if (!query) {
    setStatus('Error: Search field is empty. Please enter a name to search.', true)
    return
  }

  try {
    const { data, error } = await db
      .from('profiles')
      .select('id, name')
      .ilike('name', `%${query}%`)
      .order('name', { ascending: true })
      .limit(1)

    if (error) throw error

    if (data.length === 0) {
      setStatus(`No profile found matching "${query}".`, true)
      clearCentrePanel()
      return
    }

    await selectProfile(data[0].id)
  } catch (err) {
    setStatus(`Error looking up profile: ${err.message}`, true)
  }
}

/**
 * deleteProfile()
 * Deletes the selected profile. ON DELETE CASCADE cleans up friends rows.
 */
async function deleteProfile() {
  if (!currentProfileId) {
    setStatus('Error: No profile is selected. Click a profile in the list first.', true)
    return
  }

  const name = document.getElementById('profile-name').textContent

  if (!window.confirm(`Delete the profile for "${name}"? This cannot be undone.`)) {
    setStatus('Deletion cancelled.')
    return
  }

  try {
    const { error } = await db
      .from('profiles')
      .delete()
      .eq('id', currentProfileId)

    if (error) throw error

    clearCentrePanel()
    await loadProfileList()
    setStatus(`Profile "${name}" deleted. Friend relationships removed automatically.`)
  } catch (err) {
    setStatus(`Error deleting profile: ${err.message}`, true)
  }
}

// ================================================================
// Section 5: Edit Profile — Status, Quote, Picture
// ================================================================

/**
 * changeStatus()
 * Updates the status column and reflects the change in the centre panel.
 */
async function changeStatus() {
  if (!currentProfileId) {
    setStatus('Error: No profile is selected.', true)
    return
  }
  const newStatus = document.getElementById('input-status').value.trim()
  if (!newStatus) {
    setStatus('Error: Status field is empty.', true)
    return
  }

  try {
    const { error } = await db
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', currentProfileId)

    if (error) throw error

    document.getElementById('profile-status').textContent = newStatus
    document.getElementById('input-status').value = ''
    setStatus('Status updated successfully.')
  } catch (err) {
    setStatus(`Error updating status: ${err.message}`, true)
  }
}

/**
 * changeQuote()
 * Updates the quote column and reflects the change in the centre panel.
 */
async function changeQuote() {
  if (!currentProfileId) {
    setStatus('Error: No profile is selected.', true)
    return
  }
  const newQuote = document.getElementById('input-quote').value.trim()
  if (!newQuote) {
    setStatus('Error: Quote field is empty.', true)
    return
  }

  try {
    const { error } = await db
      .from('profiles')
      .update({ quote: newQuote })
      .eq('id', currentProfileId)

    if (error) throw error

    document.getElementById('profile-quote').textContent = newQuote
    document.getElementById('input-quote').value = ''
    setStatus('Quote updated successfully.')
  } catch (err) {
    setStatus(`Error updating quote: ${err.message}`, true)
  }
}

/**
 * changePicture()
 * Updates the picture path column and immediately updates the img src.
 */
async function changePicture() {
  if (!currentProfileId) {
    setStatus('Error: No profile is selected.', true)
    return
  }
  const newPicture = document.getElementById('input-picture').value.trim()
  if (!newPicture) {
    setStatus('Error: Picture path field is empty.', true)
    return
  }

  try {
    const { error } = await db
      .from('profiles')
      .update({ picture: newPicture })
      .eq('id', currentProfileId)

    if (error) throw error

    document.getElementById('profile-pic').src = newPicture
    document.getElementById('input-picture').value = ''
    setStatus('Picture updated successfully.')
  } catch (err) {
    setStatus(`Error updating picture: ${err.message}`, true)
  }
}

// ================================================================
// Section 6: Friends Management
// ================================================================

/**
 * addFriend()
 * Looks up the friend by name, validates the relationship,
 * inserts a new row, then re-renders the centre panel.
 */
async function addFriend() {
  if (!currentProfileId) {
    setStatus('Error: No profile is selected.', true)
    return
  }
  const friendName = document.getElementById('input-friend').value.trim()
  if (!friendName) {
    setStatus('Error: Friend name field is empty.', true)
    return
  }

  try {
    // Step 1: Resolve name to UUID (case-insensitive exact-ish match)
    const { data: found, error: findError } = await db
      .from('profiles')
      .select('id, name')
      .ilike('name', friendName)
      .limit(1)

    if (findError) throw findError
    if (found.length === 0) {
      setStatus(`Error: No profile named "${friendName}" exists. Add that profile first.`, true)
      return
    }

    const friendId = found[0].id

    // Step 2: Prevent self-friendship
    if (friendId === currentProfileId) {
      setStatus('Error: A profile cannot be friends with itself.', true)
      return
    }

    // Step 3: Normalize pair so the smaller UUID is always in profile_id,
    // then insert. This prevents (A,B) and (B,A) from coexisting as separate rows.
    const canonicalProfileId = currentProfileId < friendId ? currentProfileId : friendId
    const canonicalFriendId  = currentProfileId < friendId ? friendId : currentProfileId

    const { error: insertError } = await db
      .from('friends')
      .insert({ profile_id: canonicalProfileId, friend_id: canonicalFriendId })

    if (insertError) {
      if (insertError.code === '23505') {
        setStatus(`"${found[0].name}" is already in the friends list.`, true)
      } else {
        throw insertError
      }
      return
    }

    document.getElementById('input-friend').value = ''
    await selectProfile(currentProfileId)
    setStatus(`"${found[0].name}" added as a friend.`)
  } catch (err) {
    setStatus(`Error adding friend: ${err.message}`, true)
  }
}

/**
 * removeFriend()
 * Looks up the friend by name, then deletes the canonical friendship row.
 * Uses the same LEAST/GREATEST normalization as addFriend so the delete
 * always targets the one row that actually exists.
 */
async function removeFriend() {
  if (!currentProfileId) {
    setStatus('Error: No profile is selected.', true)
    return
  }
  const friendName = document.getElementById('input-remove-friend').value.trim()
  if (!friendName) {
    setStatus('Error: Friend name field is empty.', true)
    return
  }

  try {
    const { data: found, error: findError } = await db
      .from('profiles')
      .select('id, name')
      .ilike('name', friendName)
      .limit(1)

    if (findError) throw findError
    if (found.length === 0) {
      setStatus(`Error: No profile named "${friendName}" exists.`, true)
      return
    }

    const friendId = found[0].id

    // Normalize pair to match the canonical row stored by addFriend
    const canonicalProfileId = currentProfileId < friendId ? currentProfileId : friendId
    const canonicalFriendId  = currentProfileId < friendId ? friendId : currentProfileId

    const { data: deleted, error } = await db
      .from('friends')
      .delete()
      .eq('profile_id', canonicalProfileId)
      .eq('friend_id', canonicalFriendId)
      .select()

    if (error) throw error

    if (!deleted || deleted.length === 0) {
      setStatus(`"${found[0].name}" is not in the friends list.`, true)
      return
    }

    document.getElementById('input-remove-friend').value = ''
    await selectProfile(currentProfileId)
    setStatus(`"${found[0].name}" removed from friends list.`)
  } catch (err) {
    setStatus(`Error removing friend: ${err.message}`, true)
  }
}

// ================================================================
// Section 7: Event Listener Setup
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // ── Left panel ──────────────────────────────────────────────
  document.getElementById('btn-add')
    .addEventListener('click', addProfile)
  document.getElementById('btn-lookup')
    .addEventListener('click', lookUpProfile)
  document.getElementById('btn-delete')
    .addEventListener('click', deleteProfile)

  // ── Right panel ─────────────────────────────────────────────
  document.getElementById('btn-status')
    .addEventListener('click', changeStatus)
  document.getElementById('btn-quote')
    .addEventListener('click', changeQuote)
  document.getElementById('btn-picture')
    .addEventListener('click', changePicture)
  document.getElementById('btn-add-friend')
    .addEventListener('click', addFriend)
  document.getElementById('btn-remove-friend')
    .addEventListener('click', removeFriend)

  // ── Exit button ─────────────────────────────────────────────
  document.getElementById('btn-exit')
    .addEventListener('click', () => {
      window.location.href = 'exit.html'
    })

  // ── Enter key shortcuts ─────────────────────────────────────
  document.getElementById('input-name')
    .addEventListener('keydown', e => { if (e.key === 'Enter') addProfile() })
  document.getElementById('input-status')
    .addEventListener('keydown', e => { if (e.key === 'Enter') changeStatus() })
  document.getElementById('input-quote')
    .addEventListener('keydown', e => { if (e.key === 'Enter') changeQuote() })
  document.getElementById('input-picture')
    .addEventListener('keydown', e => { if (e.key === 'Enter') changePicture() })
  document.getElementById('input-friend')
    .addEventListener('keydown', e => { if (e.key === 'Enter') addFriend() })
  document.getElementById('input-remove-friend')
    .addEventListener('keydown', e => { if (e.key === 'Enter') removeFriend() })

  // ── Initial data load ───────────────────────────────────────
  await loadProfileList()
  setStatus('Ready. Select a profile from the list or add a new one.')
})
