package com.me.matrixchat

import android.content.Context
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.ImageView
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.me.matrixchat.Adapters.SearchAdapter
import com.me.matrixchat.Views.SearchItem
import kotlinx.coroutines.launch
import org.matrix.android.sdk.api.Matrix
import org.matrix.android.sdk.api.session.Session
import org.matrix.android.sdk.api.session.user.UserService
import org.matrix.android.sdk.api.session.user.model.User
import java.lang.Exception

class SearchActivity : AppCompatActivity() {

    private lateinit var searchEditText: EditText
    private lateinit var recyclerView: RecyclerView
    private lateinit var adapter: SearchAdapter
    private val filteredList: MutableList<SearchItem> = mutableListOf()
    private lateinit var matrix: Matrix
    private lateinit var session: Session
    private lateinit var back: ImageView
    private lateinit var progessBar : ProgressBar

    // Optionally, specify any user IDs you wish to exclude from the search.
    private val excludedUserIds: Set<String> = emptySet()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Layout contains an EditText (id: search_icon) and RecyclerView (id: recycler)
        setContentView(R.layout.custom_search_list)

        matrix = MyApplication.getMatrix(applicationContext)
        session = matrix.authenticationService().getLastAuthenticatedSession() ?: run {
            finish() // Redirect to login or handle no session case
            return
        }

        searchEditText = findViewById(R.id.search_icon)
        recyclerView = findViewById(R.id.recycler)
        progessBar = findViewById(R.id.progressBar)
        back = findViewById(R.id.back)


        showItems(filteredList)

        back.setOnClickListener{
            finish()
        }

        searchEditText.requestFocus()
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.showSoftInput(searchEditText, InputMethodManager.SHOW_IMPLICIT)


        // Listen for text changes to perform a search
        searchEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {
                // Not needed
            }
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val query = s.toString().trim()
                if (query.isEmpty()) {
                    // Clear search results if query is empty.
                    filteredList.clear()
                    adapter.notifyDataSetChanged()
                } else {
                    performUserSearch(query)
                }
            }
            override fun afterTextChanged(s: Editable?) {
                // Not needed
            }
        })
    }
    private fun showItems(filteredList: MutableList<SearchItem>){
        adapter = SearchAdapter(filteredList, this)
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
    }

    /**
     * Uses the suspend function searchUsersDirectory() to fetch users from the Matrix server.
     */
    private fun performUserSearch(query: String) {
        progessBar.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                // Call the suspend function; adjust the limit as needed.
                val users: List<User> = session.userService()
                        .searchUsersDirectory(query, 50, excludedUserIds)
                // Convert each User to your SearchItem data model.
                val results = users.map { user ->
                        val displayName = if (user.displayName.isNullOrEmpty()) user.userId else user.displayName
                    SearchItem(displayName, user.userId)
                }
                // Update UI on the main thread.
                filteredList.clear()
                filteredList.addAll(results)
                //showItems(filteredList)
                adapter.notifyDataSetChanged()
            } catch (e: Exception) {
                Log.e("SearchActivity", "Error searching users", e)
            }finally {
                progessBar.visibility = View.GONE
            }
        }
    }
}
