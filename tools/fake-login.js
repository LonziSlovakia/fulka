// Podvrhnuté prihlásenie, aby sa admin dal otvoriť bez hesla (zápis aj tak nejde – použi mock-db.js). Po ňom krok RELOAD.
localStorage.setItem("fulka-session-v1", JSON.stringify({ access_token: "test", refresh_token: "test", expires_at: 4102444800, user: { id: "test", email: "test@test" } })); "prihlásený (test)"
