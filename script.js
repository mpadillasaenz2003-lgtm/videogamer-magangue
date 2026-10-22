const cartCount = document.getElementById("cartCount");
const toast = document.getElementById("toast");
const databaseStatus = document.getElementById("databaseStatus");
const authDialog = document.getElementById("authDialog");
const cartDialog = document.getElementById("cartDialog");
const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");
const cartMessage = document.getElementById("cartMessage");
const cartList = document.getElementById("cartList");
const checkoutLink = document.getElementById("checkoutLink");
const authLabels = authForm ? authForm.querySelectorAll("label") : [];
const authSubmit = document.getElementById("authSubmit");
const signupModeBtn = document.getElementById("signupModeBtn");
const signOutBtn = document.getElementById("signOutBtn");
const accountBtn = document.getElementById("accountBtn");
let supabaseClient = null;
let currentUser = null;
let cartItems = [];
let isSignupMode = false;

function setDatabaseStatus(message, isError = false) {
  if (!databaseStatus) return;
  databaseStatus.textContent = message;
  databaseStatus.classList.toggle("error", isError);
}

function showDialog(dialog) {
  if (dialog && !dialog.open) dialog.showModal();
}

function formatPrice(price) {
  return "$" + price.toLocaleString("es-CO") + " COP";
}

function showAuthMessage(message, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}

function showCartMessage(message, isError = false) {
  if (!cartMessage) return;
  cartMessage.textContent = message;
  cartMessage.classList.toggle("error", isError);
}

function reportDatabaseError(action, error) {
  console.error(action, error);
  const message = "Ocurrió un error al conectar con la base de datos. Revisa tu conexión e intenta de nuevo.";
  setDatabaseStatus(message, true);
  showCartMessage(message, true);
  showAuthMessage(message, true);
}

function updateAuthDialog() {
  const isSignedIn = Boolean(currentUser);
  const nameField = document.getElementById("fullNameField");
  const emailInput = document.getElementById("authEmail");
  const passwordInput = document.getElementById("authPassword");

  authLabels.forEach(label => {
    label.hidden = isSignedIn || (label.id === "fullNameField" && !isSignupMode);
  });
  if (nameField) nameField.querySelector("input").required = isSignupMode && !isSignedIn;
  if (passwordInput) {
    passwordInput.autocomplete = isSignupMode ? "new-password" : "current-password";
  }
  if (emailInput) emailInput.disabled = isSignedIn;
  if (passwordInput) passwordInput.disabled = isSignedIn;
  if (isSignedIn && passwordInput) passwordInput.value = "";
  if (authSubmit) {
    authSubmit.hidden = isSignedIn;
    authSubmit.textContent = isSignupMode ? "Crear cuenta" : "Iniciar sesión";
  }
  if (signupModeBtn) {
    signupModeBtn.hidden = isSignedIn;
    signupModeBtn.textContent = isSignupMode ? "Ya tengo una cuenta" : "Crear cuenta";
  }
  if (signOutBtn) signOutBtn.hidden = !isSignedIn;

  const title = document.getElementById("authTitle");
  if (title) title.textContent = isSignedIn ? "Tu cuenta" : isSignupMode ? "Crear cuenta" : "Inicia sesión";
  if (isSignedIn) {
    showAuthMessage("Sesión iniciada como " + currentUser.email + ". Tu carrito se guarda en la nube.");
  } else if (accountBtn) {
    accountBtn.textContent = "Iniciar sesión";
  }
}

function updateAccountButton() {
  if (!accountBtn) return;
  accountBtn.textContent = currentUser ? "Mi cuenta" : "Iniciar sesión";
  accountBtn.classList.toggle("signed-in", Boolean(currentUser));
}

function updateCartCount() {
  const count = cartItems.reduce((total, item) => total + item.quantity, 0);
  if (cartCount) cartCount.textContent = String(count);
}

function updateCheckoutLink() {
  if (!checkoutLink) return;
  const validItems = cartItems.filter(item => !item.unavailable);
  checkoutLink.hidden = validItems.length === 0;
  if (!validItems.length) return;

  const total = validItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const summary = validItems.map(item => item.quantity + " x " + item.name).join(", ");
  const message = "Hola VideoGamer Magangué, quiero información para comprar: " +
    summary + ". Total de referencia: " + formatPrice(total) + ".";
  checkoutLink.href = "https://wa.me/573201234567?text=" + encodeURIComponent(message);
}

function renderCart() {
  if (!cartList) return;
  cartList.replaceChildren();

  if (!cartItems.length) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "cart-empty";
    emptyMessage.textContent = currentUser
      ? "Tu carrito está vacío. Agrega juegos desde el catálogo."
      : "Inicia sesión para guardar tus productos en el carrito.";
    cartList.append(emptyMessage);
  }

  cartItems.forEach(item => {
    const row = document.createElement("li");
    row.className = "cart-item";
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const price = document.createElement("span");
    price.textContent = item.unavailable ? "Producto no disponible" : formatPrice(item.price);
    details.append(name, price);

    const controls = document.createElement("div");
    controls.className = "cart-item-controls";
    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.textContent = "−";
    decrease.setAttribute("aria-label", "Quitar una unidad de " + item.name);
    decrease.disabled = item.unavailable;
    decrease.addEventListener("click", () => changeQuantity(item, item.quantity - 1));
    const quantity = document.createElement("span");
    quantity.textContent = String(item.quantity);
    const increase = document.createElement("button");
    increase.type = "button";
    increase.textContent = "+";
    increase.setAttribute("aria-label", "Agregar una unidad de " + item.name);
    increase.disabled = item.unavailable || item.quantity >= 99;
    increase.addEventListener("click", () => changeQuantity(item, item.quantity + 1));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-cart-item";
    remove.textContent = "Eliminar";
    remove.addEventListener("click", () => removeCartItem(item));
    controls.append(decrease, quantity, increase, remove);
    row.append(details, controls);
    cartList.append(row);
  });

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalLabel = document.getElementById("cartTotal");
  if (totalLabel) totalLabel.textContent = formatPrice(total);
  updateCartCount();
  updateCheckoutLink();
}

async function loadCatalog() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("slug, name, price")
    .eq("is_active", true);
  if (error) throw error;

  const productsBySlug = new Map();
  for (const product of data) {
    if (!product.slug || !product.name || !Number.isSafeInteger(product.price) || product.price < 0) {
      throw new Error("Supabase devolvió un producto con datos inválidos.");
    }
    productsBySlug.set(product.slug, product);
  }

  let synchronizedCount = 0;
  document.querySelectorAll(".add-cart[data-product-id]").forEach(button => {
    const product = productsBySlug.get(button.dataset.productId);
    if (!product) return;

    button.dataset.product = product.name;
    button.dataset.price = String(product.price);
    const card = button.closest(".game-card, .ps5-game-card");
    const title = card?.querySelector("h3");
    if (title) title.textContent = product.name;
    const priceLabel = card?.querySelector(".price");
    if (priceLabel) priceLabel.textContent = formatPrice(product.price);
    synchronizedCount++;
  });

  const totalProducts = document.querySelectorAll(".add-cart[data-product-id]").length;
  const partialSyncMessage = synchronizedCount < totalProducts
    ? " Los demás conservan sus precios de demostración."
    : "";
  setDatabaseStatus("Supabase conectado: " + synchronizedCount + " de " + totalProducts + " productos sincronizados." + partialSyncMessage);
}

async function loadCart() {
  if (!supabaseClient || !currentUser) {
    cartItems = [];
    renderCart();
    return;
  }

  const { data: rows, error } = await supabaseClient
    .from("cart_items")
    .select("product_slug, quantity")
    .eq("user_id", currentUser.id);
  if (error) throw error;

  if (!rows.length) {
    cartItems = [];
    renderCart();
    return;
  }

  const slugs = rows.map(row => row.product_slug);
  const { data: products, error: productsError } = await supabaseClient
    .from("products")
    .select("slug, name, price")
    .in("slug", slugs);
  if (productsError) throw productsError;
  const productsBySlug = new Map(products.map(product => [product.slug, product]));

  cartItems = rows.map(row => {
    const product = productsBySlug.get(row.product_slug);
    if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 99) {
      throw new Error("Supabase devolvió una cantidad inválida en el carrito.");
    }
    return {
      slug: row.product_slug,
      name: product ? product.name : "Producto no disponible",
      price: product ? product.price : 0,
      quantity: row.quantity,
      unavailable: !product
    };
  });
  renderCart();
}

async function addToCart(button) {
  if (!supabaseClient) {
    showAuthMessage("Configura primero el proyecto Supabase para crear cuentas y guardar el carrito.");
    showDialog(authDialog);
    return;
  }
  if (!currentUser) {
    showAuthMessage("Inicia sesión o crea una cuenta para guardar tu carrito.");
    showDialog(authDialog);
    return;
  }

  button.disabled = true;
  try {
    const { error } = await supabaseClient.rpc("add_to_cart", {
      p_product_slug: button.dataset.productId
    });
    if (error) throw error;
    await loadCart();
    if (toast) {
      toast.textContent = button.dataset.product + " guardado en tu carrito.";
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2200);
    }
  } catch (error) {
    reportDatabaseError("No fue posible agregar el producto al carrito.", error);
  } finally {
    button.disabled = false;
  }
}

async function changeQuantity(item, quantity) {
  try {
    let result;
    if (quantity < 1) {
      result = await supabaseClient.from("cart_items")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("product_slug", item.slug);
    } else {
      result = await supabaseClient.from("cart_items")
        .update({ quantity })
        .eq("user_id", currentUser.id)
        .eq("product_slug", item.slug);
    }
    if (result.error) throw result.error;
    await loadCart();
  } catch (error) {
    reportDatabaseError("No fue posible actualizar la cantidad del carrito.", error);
  }
}

async function removeCartItem(item) {
  try {
    const { error } = await supabaseClient.from("cart_items")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("product_slug", item.slug);
    if (error) throw error;
    await loadCart();
  } catch (error) {
    reportDatabaseError("No fue posible eliminar el producto del carrito.", error);
  }
}

function openAuthDialog() {
  isSignupMode = false;
  updateAuthDialog();
  if (!supabaseClient) {
    showAuthMessage("Configura primero el proyecto Supabase para crear cuentas y guardar el carrito.");
  }
  showDialog(authDialog);
}

document.querySelectorAll(".add-cart[data-product-id]").forEach(button => {
  button.addEventListener("click", () => addToCart(button));
});

const menuBtn = document.getElementById("menuBtn");
const nav = document.getElementById("nav");
if (menuBtn && nav) {
  menuBtn.addEventListener("click", () => nav.classList.toggle("open"));
  document.querySelectorAll("#nav a").forEach(link => {
    link.addEventListener("click", () => nav.classList.remove("open"));
  });
}

if (accountBtn) accountBtn.addEventListener("click", () => {
  if (nav) nav.classList.remove("open");
  openAuthDialog();
});

if (signupModeBtn) {
  signupModeBtn.addEventListener("click", () => {
    isSignupMode = !isSignupMode;
    showAuthMessage("");
    updateAuthDialog();
  });
}

if (authForm) {
  authForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!supabaseClient) {
      showAuthMessage("Configura primero el proyecto Supabase para crear cuentas y guardar el carrito.", true);
      return;
    }
    if (currentUser) return;
    if (!authForm.reportValidity()) return;

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const fullName = document.getElementById("fullName").value.trim();
    authSubmit.disabled = true;

    try {
      if (isSignupMode) {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;

        if (data.session) {
          currentUser = data.session.user;
          await loadCart();
          updateAccountButton();
          updateAuthDialog();
          authDialog.close();
          setDatabaseStatus("Cuenta creada. Ya puedes guardar tu carrito.");
        } else {
          document.getElementById("authPassword").value = "";
          showAuthMessage("Cuenta creada. Revisa tu correo para confirmar el registro y luego inicia sesión.");
        }
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        await loadCart();
        updateAccountButton();
        updateAuthDialog();
        authDialog.close();
        setDatabaseStatus("Sesión iniciada. Tu carrito se guarda en Supabase.");
      }
    } catch (error) {
      console.error("No fue posible completar el registro o inicio de sesión.", error);
      showAuthMessage(error.message || "No fue posible completar la solicitud.", true);
    } finally {
      authSubmit.disabled = false;
    }
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    if (!supabaseClient) return;
    signOutBtn.disabled = true;
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      currentUser = null;
      cartItems = [];
      document.getElementById("authPassword").value = "";
      renderCart();
      updateAccountButton();
      updateAuthDialog();
      authDialog.close();
      setDatabaseStatus("Sesión cerrada. El carrito guardado sigue asociado a tu cuenta.");
    } catch (error) {
      console.error("No fue posible cerrar la sesión.", error);
      showAuthMessage(error.message || "No fue posible cerrar la sesión.", true);
    } finally {
      signOutBtn.disabled = false;
    }
  });
}

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog)?.close());
});

const cartBtn = document.getElementById("cartBtn");
if (cartBtn) {
  cartBtn.addEventListener("click", async () => {
    if (nav) nav.classList.remove("open");
    showDialog(cartDialog);
    if (!currentUser) {
      showCartMessage("Inicia sesión o crea una cuenta para consultar tu carrito guardado.");
      return;
    }
    showCartMessage("Cargando carrito...");
    try {
      await loadCart();
      showCartMessage("");
    } catch (error) {
      reportDatabaseError("No fue posible cargar el carrito.", error);
    }
  });
}

const searchBtn = document.getElementById("searchBtn");
if (searchBtn) {
  searchBtn.addEventListener("click", () => {
    const term = prompt("¿Qué producto estás buscando?");
    if (term) alert("Buscando: " + term);
  });
}

document.querySelectorAll(".store-dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
});

async function initializeSupabase() {
  const config = window.VIDEOGAMER_SUPABASE_CONFIG;
  if (!config || !config.url || !config.anonKey) {
    setDatabaseStatus("Supabase pendiente: completa la URL y la clave pública en supabase-config.js.");
    return;
  }

  try {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("No se pudo cargar la biblioteca de Supabase.");
    }
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session ? session.user : null;
      updateAccountButton();
      updateAuthDialog();
      window.setTimeout(() => {
        loadCart().catch(error => reportDatabaseError("No fue posible sincronizar el carrito.", error));
      }, 0);
    });

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    currentUser = data.session ? data.session.user : null;
    updateAccountButton();
    updateAuthDialog();
    await loadCatalog();
    await loadCart();
  } catch (error) {
    console.error("No fue posible iniciar Supabase.", error);
    setDatabaseStatus("No se pudo conectar con Supabase. Revisa la URL, la clave pública y las tablas configuradas.", true);
  }
}

renderCart();
initializeSupabase();
