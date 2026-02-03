# Intégration Paiement (Stripe / PayPal) — Guide de départ

Ce fichier explique comment remplacer les stubs de paiement du prototype par une intégration réelle.

Stripe (recommandé pour une intégration complète)
- Créer un compte Stripe et récupérer les clés `STRIPE_SECRET` et `STRIPE_PUBLISHABLE`.
- Installer `stripe` (`npm install stripe`).
- Endpoint server-side: créer une route qui appelle `stripe.checkout.sessions.create(...)` avec `line_items` et `success_url`/`cancel_url`.
- Ajouter un endpoint webhook sécurisé pour écouter `checkout.session.completed` et créditer l'utilisateur (`transactions` / `users.balance`). Vérifier la signature du webhook.

PayPal
- Utiliser PayPal Checkout (Server-side REST API) ou Checkout SDK.
- Créer des orders côté serveur, renvoyer le lien de paiement côté client.
- Mettre en place un webhook IPN / Webhook pour confirmer la transaction côté serveur.

Notes importantes
- Ne jamais faire confiance aux appels client pour créditer le compte : valider la transaction via webhook/verify API.
- Stocker les clés secrètes dans des variables d'environnement (ne pas hardcoder).
- Pour production : gérer idempotence, montants, taxes, remboursement et historique des transactions.
