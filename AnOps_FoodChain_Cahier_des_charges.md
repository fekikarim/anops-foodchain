# AnOps FoodChain --- Cahier des charges technique

## Application de traçabilité alimentaire basée sur la blockchain (FT + NFT)

**Équipe :** Karim Feki et Nesrine Derouiche\
**Sujet :** Supply Chain alimentaire --- traçabilité des fruits et
légumes frais\
**Contexte :** Projet académique Blockchain --- année 2026/2027\
**Stack imposée :** Node.js, Truffle, Ganache, MetaMask, Solidity\
**Livrable :** Deux smart contracts distincts et interconnectés (un FT
et un NFT), plus une application frontend de démonstration.

------------------------------------------------------------------------

# 1. Vision générale du projet

## 1.1 Nom et concept

**AnOps FoodChain --- Blockchain-Based Food Supply Chain Traceability**

AnOps FoodChain est une application décentralisée (DApp) destinée à
améliorer la transparence et la traçabilité des produits alimentaires,
en particulier les fruits et légumes frais, depuis leur exploitation
agricole jusqu'au détaillant.

L'application doit permettre de suivre chaque lot de produits à travers
les différentes étapes de la chaîne d'approvisionnement :

1.  Production et récolte chez le producteur.
2.  Enregistrement du lot dans le système.
3.  Expédition par le producteur ou le transporteur.
4.  Réception par le grossiste ou le centre de distribution.
5.  Transfert vers un autre acteur.
6.  Réception par le détaillant.
7.  Consultation de l'historique complet du lot.

L'objectif est de disposer d'un historique partagé, vérifiable et
difficile à modifier rétroactivement. La blockchain conserve les
transactions et les événements enregistrés par les utilisateurs.

**Important :** la blockchain ne prouve pas automatiquement qu'un
produit provient réellement d'une ferme donnée, ni qu'il est frais ou de
bonne qualité. Elle garantit principalement l'intégrité et la
traçabilité des informations qui lui sont soumises. La fiabilité des
données dépend donc des acteurs, des contrôles et des procédures de
vérification hors chaîne.

## 1.2 Relation avec AnOps

AnOps est une plateforme ERP / business operations multi-tenant et
assistée par l'IA, destinée aux petites et moyennes entreprises. Ses
domaines comprennent notamment les ressources humaines et la paie, le
CRM et les ventes, la finance, l'inventaire, les achats, la fabrication,
le marketing, l'administration des entreprises et les workflows
d'assistance.

**AnOps FoodChain est un cas d'usage spécialisé et un module de
démonstration inspiré de l'écosystème AnOps.** Il ne faut pas confondre
ce projet académique avec l'ensemble de la plateforme ERP. Le frontend
doit présenter une expérience cohérente avec une application de gestion
professionnelle : tableau de bord, gestion des lots, acteurs,
transferts, récompenses et consultation de la blockchain.

Pour ce projet, le périmètre fonctionnel se concentre sur la chaîne
d'approvisionnement alimentaire et l'interaction entre les deux smart
contracts.

## 1.3 Problématique

Dans une chaîne alimentaire traditionnelle, les informations concernant
l'origine, la récolte, le transport et la réception des produits peuvent
être dispersées entre plusieurs intervenants et systèmes. Cela rend
parfois difficile :

-   l'identification rapide de l'origine d'un lot ;
-   la vérification des étapes de son parcours ;
-   la détection d'informations incohérentes ;
-   la détermination des acteurs responsables de chaque opération ;
-   la gestion d'un rappel lorsqu'un lot présente un problème.

AnOps FoodChain propose une solution où les étapes importantes sont
enregistrées sur une blockchain locale de développement, avec des
transactions signées par les comptes MetaMask des acteurs.

------------------------------------------------------------------------

# 2. Répartition obligatoire du travail

Le projet comporte **deux smart contracts développés séparément**,
chacun utilisant un standard de token différent.

  ----------------------------------------------------------------------------
  Membre            Smart contract         Standard          Responsabilité
                                                             principale
  ----------------- ---------------------- ----------------- -----------------
  Karim Feki        `FoodChainToken.sol`   FT --- ERC-20     Token fongible de
                                                             récompense pour
                                                             les acteurs de la
                                                             chaîne
                                                             alimentaire

  Nesrine Derouiche `FoodBatchNFT.sol`     NFT --- ERC-721   Passeport
                                                             numérique unique
                                                             et traçabilité
                                                             des lots
                                                             alimentaires
  ----------------------------------------------------------------------------

Les deux membres doivent comprendre l'architecture globale et savoir
expliquer les deux contrats, même si chacun est responsable de
l'implémentation et des tests approfondis de son propre contrat.

## 2.1 Karim --- FT / ERC-20 : FoodChainToken

Karim développe un token fongible conforme au standard ERC-20.

**Nom du token :** FoodChainToken\
**Symbole proposé :** FCT\
**Standard :** ERC-20\
**Fichier :** `FoodChainToken.sol`

### Rôle du FT dans le projet

Le FoodChainToken est un système de points de récompense numériques
destiné à encourager les acteurs à participer correctement à la
traçabilité alimentaire.

Exemples :

-   Un producteur reçoit des tokens lorsqu'il enregistre correctement un
    nouveau lot.
-   Un transporteur reçoit des tokens lorsqu'il déclare une livraison
    qui est ensuite confirmée par le destinataire.
-   Un grossiste reçoit des tokens lorsqu'il confirme la réception et
    enregistre un transfert valide.
-   Un détaillant peut recevoir des tokens lorsqu'il confirme la
    réception finale.

Ces tokens représentent des **points utilitaires de démonstration**, et
non de l'argent, une cryptomonnaie destinée à être vendue, ni une
représentation directe de kilogrammes de fruits ou légumes.

### Pourquoi utiliser un FT ?

Un ERC-20 est fongible : chaque unité du token est interchangeable avec
une autre unité de même valeur. Il convient donc à un système de
récompenses ou de crédits communs à tous les acteurs.

Par exemple, 10 FCT reçus par un producteur ont la même nature que 10
FCT reçus par un transporteur. Le token n'identifie pas un lot
particulier ; cette responsabilité appartient au NFT.

### Fonctionnalités attendues

Le contrat doit inclure au minimum :

1.  **Initialisation**

    -   Définir le nom et le symbole du token.
    -   Définir les décimales conformément au standard ERC-20.
    -   Définir le propriétaire ou administrateur initial.
    -   Prévoir une supply initiale ou un mécanisme de mint contrôlé.

2.  **Fonctionnalités ERC-20**

    -   `totalSupply`
    -   `balanceOf`
    -   `transfer`
    -   `approve`
    -   `allowance`
    -   `transferFrom`

    Ces fonctionnalités doivent être conformes au standard ERC-20. Il
    est préférable d'utiliser une implémentation OpenZeppelin plutôt que
    de réécrire manuellement les mécanismes sensibles du standard.

3.  **Gestion des récompenses**

    -   Permettre à une adresse autorisée de distribuer des récompenses.
    -   Définir des montants de récompense cohérents selon les
        opérations validées.
    -   Empêcher un utilisateur non autorisé de créer ou distribuer
        librement des tokens.
    -   Émettre des événements permettant au frontend de présenter les
        récompenses.

4.  **Contrôle d'accès**

    -   Seul l'administrateur ou un rôle autorisé peut gérer la
        distribution/mint des récompenses.
    -   Prévoir une gestion claire des rôles.
    -   Empêcher les doubles récompenses pour une même opération.

5.  **Sécurité**

    -   Vérifier les adresses nulles.
    -   Vérifier les permissions avant toute opération privilégiée.
    -   Utiliser des erreurs personnalisées (`custom errors`) ou des
        messages de revert explicites.
    -   Émettre les événements nécessaires.
    -   Éviter les fonctions administratives excessives ou non
        justifiées.

### Logique de récompense recommandée

Pour une première version académique, garder un modèle simple et
déterministe :

  Événement validé                                 Récompense indicative
  ---------------------------------------------- -----------------------
  Enregistrement d'un lot valide                                  10 FCT
  Livraison confirmée par le destinataire                          5 FCT
  Réception confirmée par un grossiste                             5 FCT
  Réception finale confirmée par le détaillant                     5 FCT

Les montants sont des paramètres de démonstration. Ils doivent être
configurables par l'administrateur ou clairement définis dans le
contrat.

**Règle essentielle :** une récompense de livraison ne doit pas être
accordée simplement parce que l'expéditeur affirme avoir livré le lot.
Elle doit dépendre d'une confirmation vérifiable du destinataire ou
d'une opération validée par le contrat NFT.

### Fonctions métier suggérées

Les noms définitifs peuvent être adaptés à l'implémentation, mais le
contrat devrait exposer des fonctions équivalentes à :

-   `rewardActor(address actor, uint256 amount, bytes32 operationId)` :
    distribuer une récompense à un acteur autorisé, avec protection
    contre les doublons.
-   `setRewardAmount(bytes32 actionType, uint256 amount)` : configurer
    un montant de récompense, si cette flexibilité est retenue.
-   `setAuthorizedCaller(address caller, bool authorized)` : autoriser
    le contrat NFT ou un service précis à déclencher certaines
    récompenses.
-   `pause()` / `unpause()` : suspendre ou reprendre les opérations
    sensibles, si le mécanisme est implémenté.

Ne pas exposer une fonction publique permettant à n'importe quelle
adresse de se créer des tokens.

### Événements suggérés

-   `RewardIssued(address indexed actor, uint256 amount, bytes32 indexed operationId)`
-   `RewardAmountUpdated(bytes32 indexed actionType, uint256 amount)`
-   `AuthorizedCallerUpdated(address indexed caller, bool authorized)`

------------------------------------------------------------------------

## 2.2 Nesrine --- NFT / ERC-721 : FoodBatchNFT

Nesrine développe un NFT non fongible conforme au standard ERC-721.

**Nom de la collection :** Food Batch Passport\
**Symbole proposé :** FBP\
**Standard :** ERC-721\
**Fichier :** `FoodBatchNFT.sol`

### Rôle du NFT dans le projet

Chaque lot de fruits ou légumes enregistré dans l'application est
représenté par un NFT unique.

Exemples de lots :

-   Lot de tomates --- TOM-TN-001 --- 500 kg --- récolté à Nabeul.
-   Lot d'oranges --- ORG-TN-002 --- 800 kg --- récolté à Cap Bon.
-   Lot de pommes de terre --- POT-TN-003 --- 1 200 kg --- récolté à
    Béja.

Chaque NFT constitue le **passeport numérique d'un lot**. Il possède un
identifiant unique et des informations de traçabilité. Le NFT ne
représente pas une unité de fruit ou un kilogramme : il représente un
lot identifié.

### Pourquoi utiliser un NFT ?

Un ERC-721 est non fongible : chaque token possède un identifiant unique
(`tokenId`). Deux lots différents doivent donc avoir deux identifiants
NFT différents, même s'ils contiennent le même produit.

Le NFT est adapté à la traçabilité parce qu'il permet d'associer un
identifiant unique à un lot et de suivre les étapes importantes de son
parcours.

### Données d'un lot

Chaque lot doit contenir au minimum :

-   Identifiant métier du lot (`batchCode`), unique.
-   Type de produit : tomate, orange, pomme de terre, etc.
-   Nom du producteur ou identifiant de l'acteur.
-   Région / lieu d'origine.
-   Date de récolte.
-   Quantité initiale et unité (kg, par exemple).
-   Date d'enregistrement.
-   Statut actuel.
-   Adresse du détenteur ou acteur responsable actuel.
-   URI de métadonnées du NFT, si une approche `tokenURI` est retenue.

Les données volumineuses ou les documents (photos, certificats,
factures) ne doivent pas être stockés directement sur la blockchain.
Pour le prototype, utiliser des champs courts on-chain et, si
nécessaire, une URI vers des métadonnées JSON stockées hors chaîne. Le
frontend doit distinguer clairement les données enregistrées sur
blockchain des données externes.

### Cycle de vie d'un lot

Le contrat doit représenter un parcours cohérent :

`Created → InTransit → Received → InTransit → Received → Delivered`

Il faut également prévoir des statuts exceptionnels, par exemple :

-   `Flagged` : lot signalé comme suspect.
-   `Recalled` : lot rappelé.
-   `Cancelled` : lot annulé, si cette option est nécessaire.

Le contrat doit empêcher les transitions incohérentes. Par exemple, un
lot déjà rappelé ne doit pas pouvoir être expédié normalement.

### Fonctionnalités attendues

1.  **Création d'un lot**
    -   Vérifier que l'acteur est autorisé à enregistrer un lot.
    -   Vérifier que le code métier du lot est unique.
    -   Valider les champs obligatoires.
    -   Créer un NFT ERC-721 unique.
    -   Associer les métadonnées et l'historique initial.
    -   Émettre un événement de création.
2.  **Transfert / expédition**
    -   Enregistrer l'adresse du destinataire.
    -   Enregistrer une date ou un timestamp d'expédition.
    -   Mettre à jour le statut du lot.
    -   Empêcher un acteur non autorisé de lancer un transfert.
    -   Émettre un événement de transfert ou d'expédition.
3.  **Confirmation de réception**
    -   Seul le destinataire prévu peut confirmer la réception.
    -   Vérifier que le lot est bien en transit.
    -   Enregistrer la confirmation et le timestamp.
    -   Mettre à jour le détenteur / responsable actuel.
    -   Émettre un événement de réception.
4.  **Historique**
    -   Conserver les étapes successives du lot.
    -   Enregistrer l'acteur, le type d'opération, le timestamp et les
        informations pertinentes.
    -   Permettre au frontend de récupérer et afficher l'historique
        chronologique.
5.  **Signalement et rappel**
    -   Permettre à un rôle autorisé de signaler un lot.
    -   Permettre à l'administrateur ou à un rôle qualité autorisé de
        rappeler un lot.
    -   Empêcher la poursuite normale du parcours d'un lot rappelé.
6.  **Consultation**
    -   Consulter les informations d'un NFT par `tokenId`.
    -   Retrouver un lot à partir de son `batchCode`.
    -   Consulter son détenteur et son statut.
    -   Consulter les étapes de son historique.

### Fonctions métier suggérées

Les noms peuvent être adaptés, mais les opérations suivantes doivent
être couvertes :

-   `registerBatch(...)` : créer le passeport NFT d'un nouveau lot.
-   `shipBatch(uint256 tokenId, address recipient, ...)` : enregistrer
    l'expédition vers un destinataire.
-   `confirmReceipt(uint256 tokenId, ...)` : permettre au destinataire
    prévu de confirmer la réception.
-   `flagBatch(uint256 tokenId, ...)` : signaler un lot.
-   `recallBatch(uint256 tokenId, ...)` : rappeler un lot.
-   `getBatch(uint256 tokenId)` : récupérer les informations
    principales.
-   `getBatchByCode(...)` : retrouver un lot à partir de son code.
-   `getBatchHistory(uint256 tokenId)` : récupérer l'historique.

Les opérations de transfert doivent suivre une logique métier explicite.
Ne pas laisser le détenteur appeler librement les fonctions de réception
au nom d'un autre acteur.

### Événements suggérés

-   `BatchRegistered(uint256 indexed tokenId, bytes32 indexed batchCode, address indexed producer)`
-   `BatchShipped(uint256 indexed tokenId, address indexed from, address indexed to)`
-   `BatchReceived(uint256 indexed tokenId, address indexed recipient)`
-   `BatchFlagged(uint256 indexed tokenId, address indexed actor, bytes32 reasonCode)`
-   `BatchRecalled(uint256 indexed tokenId, address indexed actor)`

### Point important sur la propriété du NFT

Il faut choisir et documenter une règle cohérente :

-   **Option recommandée pour le prototype :** le NFT est détenu par
    l'acteur responsable actuel et sa propriété évolue uniquement après
    une réception confirmée.
-   L'expédition enregistre un destinataire attendu et un statut
    `InTransit`.
-   À la confirmation de réception, le NFT peut être transféré au
    destinataire et l'historique est mis à jour.

Ne pas mélanger le transfert ERC-721 standard et le transfert métier de
la chaîne alimentaire sans contrôle. Si le transfert standard est
conservé, il faut le restreindre ou le surcharger correctement afin
qu'il ne permette pas de contourner les règles de traçabilité.

------------------------------------------------------------------------

# 3. Interaction entre les deux smart contracts

Les contrats doivent être distincts, mais fonctionner ensemble.

## 3.1 Architecture logique

``` text
                 Utilisateur / Acteur
                         |
                      MetaMask
                         |
                  Frontend AnOps
                         |
                  Node.js / Web3
                         |
             Réseau local Ganache
                         |
             +-----------+-----------+
             |                       |
      FoodBatchNFT              FoodChainToken
       ERC-721                    ERC-20
             |                       ^
             |                       |
             +--- récompenses -------+
                 après opérations
                 validées
```

Le contrat NFT gère les lots et leur traçabilité. Le contrat FT gère les
récompenses.

## 3.2 Scénario d'interaction recommandé

1.  L'administrateur déploie `FoodChainToken`.
2.  L'administrateur déploie `FoodBatchNFT` en lui transmettant
    l'adresse du contrat FT.
3.  Le contrat NFT enregistre l'adresse du contrat FT.
4.  Le contrat FT autorise l'adresse du contrat NFT à déclencher les
    récompenses prévues.
5.  Un producteur connecté à MetaMask crée un lot.
6.  Le contrat NFT vérifie les règles et crée le NFT.
7.  Le contrat NFT appelle le contrat FT pour attribuer la récompense de
    création au producteur, si cette règle est activée.
8.  Le transporteur enregistre l'expédition.
9.  Le destinataire confirme la réception.
10. Après validation de la réception, le contrat NFT peut déclencher une
    récompense pour l'opération, selon la politique définie.

**Important :** les récompenses doivent être déclenchées une seule fois
par opération. Utiliser un identifiant d'opération unique
(`operationId`) et une vérification anti-doublon dans le contrat FT.

L'appel inter-contrats doit être sécurisé. Le contrat FT ne doit
accepter les demandes de récompense que d'une adresse explicitement
autorisée. Le contrat NFT ne doit pas pouvoir distribuer des montants
arbitraires si le système prévoit des récompenses fixes ou configurées.

## 3.3 Déploiement et adresses

Les deux contrats doivent être déployés sur le même réseau Ganache pour
interagir directement. Le frontend doit utiliser les adresses réellement
retournées par Truffle au déploiement, jamais des adresses inventées ou
codées en dur dans plusieurs fichiers.

Les adresses, ABI et identifiants de réseau doivent être centralisés
dans une configuration frontend générée ou mise à jour après le
déploiement.

------------------------------------------------------------------------

# 4. Acteurs et permissions

Le prototype doit simuler les principaux acteurs de la chaîne
alimentaire.

  -----------------------------------------------------------------------
  Acteur                              Responsabilités principales
  ----------------------------------- -----------------------------------
  Admin / Organisation                Configure le système, autorise les
                                      acteurs et gère les paramètres

  Farmer / Producteur                 Enregistre les lots et confirme les
                                      informations de récolte

  Transporter                         Prend en charge les lots et
                                      enregistre les expéditions

  Wholesaler / Grossiste              Confirme les réceptions et peut
                                      organiser un nouveau transfert

  Retailer / Détaillant               Confirme la réception finale

  Consumer / Client                   Consulte les informations publiques
                                      du lot
  -----------------------------------------------------------------------

Les adresses Ethereum identifient les utilisateurs sur la blockchain.
Pour le prototype, une gestion simple des rôles par adresse peut être
utilisée.

Les rôles doivent être vérifiés côté smart contract pour toute opération
sensible. Masquer un bouton dans le frontend ne constitue pas un
contrôle d'accès suffisant.

------------------------------------------------------------------------

# 5. Outils et environnement de développement

Les outils suivants sont ceux demandés pour le projet. Ils doivent être
utilisés dans le workflow de développement.

## 5.1 Node.js

**Rôle :** environnement JavaScript côté serveur et outil d'exécution
des scripts du projet.

Utilisation : - gérer les dépendances npm ; - exécuter Truffle ; -
exécuter les tests automatisés ; - lancer le frontend ; - utiliser les
bibliothèques Web3 côté interface.

Vérification :

``` bash
node --version
npm --version
```

Utiliser une version LTS récente compatible avec les versions choisies
de Truffle et des dépendances.

## 5.2 Truffle

**Rôle :** framework de développement, compilation, test et déploiement
des smart contracts Solidity.

Utilisation : - organiser les contrats dans `contracts/` ; - configurer
le réseau Ganache ; - compiler les contrats ; - écrire les migrations
; - déployer les contrats ; - exécuter les tests.

Installation locale recommandée dans le projet :

``` bash
npm init -y
npm install --save-dev truffle
```

Commandes courantes :

``` bash
npx truffle init
npx truffle compile
npx truffle migrate --network development
npx truffle test
```

Ne pas supposer que les commandes ou versions historiques de Truffle
fonctionnent sans adaptation : vérifier la compatibilité des versions
installées et conserver un `package-lock.json`.

## 5.3 Ganache

**Rôle :** blockchain Ethereum locale de développement.

Ganache fournit : - un réseau blockchain local ; - des comptes de test
préfinancés ; - des clés privées de test ; - des transactions et des
reçus ; - un historique de blocs ; - un environnement sans frais réels.

Utilisation : 1. Lancer Ganache (application de bureau ou CLI
compatible). 2. Créer ou sélectionner un workspace. 3. Noter l'URL RPC,
généralement `http://127.0.0.1:7545` pour Ganache GUI, ou celle affichée
par la configuration utilisée. 4. Noter le Chain ID affiché. 5. Utiliser
les comptes de test fournis par Ganache. 6. Configurer Truffle pour se
connecter à ce réseau.

Ne jamais utiliser les clés privées des comptes Ganache dans un réseau
public ou avec de vrais fonds.

## 5.4 MetaMask

**Rôle :** portefeuille Ethereum utilisé pour connecter les utilisateurs
au frontend et signer les transactions.

Configuration : 1. Installer l'extension MetaMask. 2. Ajouter un réseau
personnalisé Ganache. 3. Renseigner le RPC URL de Ganache. 4. Renseigner
le Chain ID exact. 5. Importer uniquement un compte de test Ganache dans
l'environnement local. 6. Vérifier que le compte connecté possède des
fonds de test.

Le frontend doit : - détecter MetaMask ; - demander explicitement la
connexion du portefeuille ; - afficher l'adresse connectée ; - vérifier
le réseau ; - demander la signature avant chaque transaction ; -
afficher les états de transaction : en attente, confirmée ou échouée.

Ne jamais demander à l'utilisateur sa phrase secrète ou sa clé privée.
Le frontend ne doit jamais les stocker.

## 5.5 Solidity et OpenZeppelin

**Solidity** est le langage des smart contracts.

**OpenZeppelin Contracts** fournit des implémentations éprouvées des
standards ERC-20 et ERC-721 ainsi que des mécanismes de contrôle
d'accès.

Installation possible :

``` bash
npm install @openzeppelin/contracts
```

Utiliser une version compatible avec la version du compilateur Solidity
choisie. Fixer les versions dans le projet et éviter de mélanger des
exemples provenant de versions différentes.

Le but académique est de développer les contrats métier et de comprendre
les standards, pas de réinventer les implémentations fondamentales des
tokens.

## 5.6 Frontend

Le frontend peut être réalisé avec **React** ou **Next.js**, selon les
compétences et le choix de l'équipe. Il doit être connecté à MetaMask et
aux contrats déployés.

Bibliothèques possibles : - `ethers` pour communiquer avec Ethereum ; -
React ou Next.js pour l'interface ; - TypeScript recommandé ; - une
bibliothèque UI cohérente pour construire un dashboard professionnel.

Le frontend n'est pas un simple prototype visuel : les actions
principales doivent réellement appeler les smart contracts déployés sur
Ganache.

------------------------------------------------------------------------

# 6. Structure de projet recommandée

Une structure unique facilite le travail en équipe et l'intégration.

``` text
anops-foodchain/
├── contracts/
│   ├── FoodChainToken.sol
│   └── FoodBatchNFT.sol
│
├── migrations/
│   ├── 1_deploy_food_chain_token.js
│   └── 2_deploy_food_batch_nft.js
│
├── test/
│   ├── FoodChainToken.test.js
│   ├── FoodBatchNFT.test.js
│   └── FoodChainIntegration.test.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/              # ou app/ avec Next.js
│   │   ├── features/
│   │   │   ├── dashboard/
│   │   │   ├── batches/
│   │   │   ├── actors/
│   │   │   ├── rewards/
│   │   │   └── traceability/
│   │   ├── blockchain/
│   │   │   ├── provider.ts
│   │   │   ├── contracts.ts
│   │   │   ├── FoodChainToken.json
│   │   │   └── FoodBatchNFT.json
│   │   └── ...
│   └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── TESTING.md
│
├── truffle-config.js
├── package.json
└── README.md
```

Les ABI sont générées par la compilation Truffle. Elles ne doivent pas
être écrites manuellement. Les fichiers d'artifacts ou les ABI
nécessaires au frontend doivent être copiés ou importés de manière
reproductible.

Ne pas versionner de secrets ou de clés privées. Pour Ganache, les
comptes sont uniquement des comptes de test.

------------------------------------------------------------------------

# 7. Workflow complet de développement

## Phase 1 --- Préparation

1.  Installer Node.js.
2.  Créer le dépôt Git du projet.
3.  Initialiser Truffle.
4.  Installer OpenZeppelin.
5.  Lancer Ganache.
6.  Configurer le réseau `development` dans Truffle.
7.  Configurer MetaMask sur le réseau Ganache.
8.  Vérifier qu'un contrat de test simple peut être compilé et déployé.

**Résultat attendu :** environnement local opérationnel pour les deux
membres.

## Phase 2 --- Développement du FT par Karim

1.  Créer `FoodChainToken.sol`.
2.  Implémenter ERC-20 avec OpenZeppelin.
3.  Ajouter les rôles ou permissions nécessaires.
4.  Ajouter le mécanisme de récompense contrôlé.
5.  Ajouter la protection contre les doubles récompenses.
6.  Ajouter les événements.
7.  Écrire les tests unitaires.
8.  Compiler et tester avec Truffle.

**Résultat attendu :** un contrat ERC-20 fonctionnel, sécurisé pour le
périmètre académique et prêt à être appelé par le contrat NFT.

## Phase 3 --- Développement du NFT par Nesrine

1.  Créer `FoodBatchNFT.sol`.
2.  Implémenter ERC-721 avec OpenZeppelin.
3.  Définir la structure de données d'un lot.
4.  Ajouter la création de lots et la génération d'identifiants uniques.
5.  Ajouter le cycle expédition / réception.
6.  Ajouter l'historique et les événements.
7.  Ajouter les rôles et permissions.
8.  Ajouter les fonctions de signalement et de rappel.
9.  Intégrer l'appel sécurisé au contrat FT.
10. Écrire les tests unitaires.

**Résultat attendu :** un contrat ERC-721 permettant de créer et suivre
les passeports numériques des lots.

## Phase 4 --- Intégration des deux contrats

1.  Compiler les deux contrats.
2.  Déployer le FT en premier.
3.  Déployer le NFT avec l'adresse du FT.
4.  Autoriser le contrat NFT dans le contrat FT.
5.  Tester l'enregistrement d'un lot.
6.  Vérifier que la récompense est attribuée au bon acteur.
7.  Tester une réception confirmée.
8.  Vérifier qu'une même opération ne peut pas être récompensée deux
    fois.
9.  Tester les tentatives non autorisées.

**Résultat attendu :** les deux contrats fonctionnent ensemble sur le
même réseau Ganache.

## Phase 5 --- Développement frontend

Créer une interface professionnelle et responsive qui permet de
démontrer le fonctionnement réel du système.

Écrans recommandés :

### A. Dashboard

-   Nombre total de lots.
-   Lots en transit.
-   Lots reçus / livrés.
-   Lots signalés ou rappelés.
-   Nombre d'acteurs.
-   Total des récompenses distribuées.
-   Activité blockchain récente.

Les statistiques doivent provenir des contrats ou de leurs événements,
et non de valeurs statiques inventées.

### B. Gestion des lots

-   Liste des lots.
-   Recherche par code de lot ou identifiant NFT.
-   Filtres par produit, statut et acteur.
-   Création d'un nouveau lot.
-   Consultation de la fiche détaillée d'un lot.

### C. Détail d'un lot

Afficher : - code du lot ; - NFT ID ; - produit ; - origine ; - date de
récolte ; - quantité ; - propriétaire / responsable actuel ; - statut
; - historique chronologique ; - transactions associées lorsque
disponibles.

### D. Acteurs

-   Liste des adresses et rôles.
-   Statut d'autorisation.
-   Affichage du compte MetaMask connecté.
-   Actions administratives réservées à l'administrateur.

La gestion des rôles doit être vérifiée par les smart contracts. Le
frontend ne doit pas être la seule barrière de sécurité.

### E. Rewards / FoodChainToken

-   Solde FCT du portefeuille connecté.
-   Nom et symbole du token.
-   Historique des récompenses.
-   Motif et montant de chaque récompense.
-   Transactions correspondantes.

### F. Blockchain / Transactions

-   Hash de transaction.
-   Fonction appelée.
-   Adresse de l'émetteur.
-   Statut.
-   Bloc.
-   Date ou timestamp.
-   Lien vers les détails disponibles dans Ganache ou un explorateur
    local, si utilisé.

### G. Connexion portefeuille

-   Bouton Connect Wallet.
-   Adresse connectée.
-   Réseau actif.
-   Message clair si MetaMask est absent ou si le réseau n'est pas
    Ganache.
-   Gestion des refus de signature et erreurs RPC.

## Phase 6 --- Tests et validation finale

Tous les scénarios métier importants doivent être testés automatiquement
et démontrés manuellement dans l'interface.

------------------------------------------------------------------------

# 8. Scénario de démonstration de bout en bout

Le scénario suivant doit être reproductible pendant la présentation.

## Comptes de test

Préparer plusieurs comptes Ganache et les associer aux rôles :

-   Compte 1 : Admin.
-   Compte 2 : Farmer.
-   Compte 3 : Transporter.
-   Compte 4 : Wholesaler.
-   Compte 5 : Retailer.
-   Compte 6 : Unauthorized actor.

## Déroulement

1.  L'administrateur configure les autorisations des acteurs.
2.  Le producteur se connecte avec MetaMask.
3.  Il enregistre un lot de tomates :
    -   Code : `TOM-TN-001`
    -   Produit : Tomates
    -   Origine : Nabeul, Tunisie
    -   Date de récolte : date de démonstration
    -   Quantité : 500 kg
4.  Le contrat NFT crée un NFT unique représentant le passeport de ce
    lot.
5.  Le producteur reçoit les récompenses FCT prévues.
6.  Le producteur expédie le lot au transporteur ou au grossiste selon
    le workflow retenu.
7.  Le destinataire confirme la réception depuis son propre portefeuille
    MetaMask.
8.  Le NFT enregistre la nouvelle étape et met à jour le responsable
    actuel.
9.  Le contrat attribue la récompense correspondante une seule fois.
10. Le grossiste expédie le lot au détaillant.
11. Le détaillant confirme la réception finale.
12. Un utilisateur consulte le lot et voit l'ensemble de son historique.
13. Un compte non autorisé tente de créer ou modifier un lot : la
    transaction doit échouer.
14. Une tentative de double récompense doit également échouer.

À la fin, le jury doit pouvoir constater les transactions dans Ganache
et les données dans l'interface.

------------------------------------------------------------------------

# 9. Tests obligatoires

## 9.1 Tests du FT --- Karim

-   Déploiement du token.
-   Vérification du nom, symbole, décimales et supply.
-   Vérification des soldes.
-   Transfert ERC-20 valide.
-   Approbation et `transferFrom`.
-   Distribution d'une récompense par une adresse autorisée.
-   Rejet d'une récompense demandée par une adresse non autorisée.
-   Rejet d'une opération déjà récompensée.
-   Vérification des événements émis.
-   Vérification des limites de mint ou de distribution retenues.

## 9.2 Tests du NFT --- Nesrine

-   Déploiement du NFT.
-   Création d'un lot valide.
-   Rejet d'un code de lot déjà utilisé.
-   Rejet de champs obligatoires invalides.
-   Vérification de l'identifiant NFT.
-   Vérification des métadonnées.
-   Expédition valide.
-   Rejet d'une expédition par un acteur non autorisé.
-   Réception par le destinataire prévu.
-   Rejet d'une réception par une autre adresse.
-   Rejet d'une transition de statut incohérente.
-   Vérification de l'historique.
-   Signalement et rappel d'un lot.
-   Vérification des événements.

## 9.3 Tests d'intégration

-   Le NFT appelle correctement le FT.
-   Le FT reconnaît le contrat NFT autorisé.
-   La création d'un lot déclenche la récompense prévue.
-   La confirmation d'une réception déclenche la récompense prévue.
-   Une même opération ne peut pas déclencher plusieurs récompenses.
-   Une transaction échouée ne doit pas laisser un état partiellement
    modifié.
-   Les erreurs d'un contrat appelé doivent être correctement propagées.

## 9.4 Tests frontend

-   Connexion et déconnexion MetaMask.
-   Réseau incorrect détecté.
-   Compte non autorisé correctement limité.
-   États de chargement et de confirmation des transactions.
-   Erreurs de signature et de transaction affichées clairement.
-   Actualisation des informations après confirmation on-chain.
-   Recherche d'un lot et affichage de son historique.
-   Affichage du solde FCT et de l'historique des récompenses.

------------------------------------------------------------------------

# 10. Exigences de qualité, sécurité et bonnes pratiques

L'agent IA chargé de réaliser le projet doit respecter les exigences
suivantes :

1.  **Standards :** utiliser des implémentations OpenZeppelin
    compatibles et respecter ERC-20 et ERC-721.
2.  **Contrôle d'accès :** les permissions sont vérifiées dans les smart
    contracts, pas uniquement dans le frontend.
3.  **Validation :** vérifier les adresses, quantités, identifiants,
    statuts et données obligatoires.
4.  **Anti-doublon :** empêcher la création de lots avec un code déjà
    utilisé et les récompenses multiples pour une opération.
5.  **Événements :** émettre des événements pour les actions métier
    importantes.
6.  **Atomicité :** les interactions entre contrats doivent échouer
    proprement si une étape échoue.
7.  **Clés privées :** ne jamais intégrer de clé privée, seed phrase ou
    secret dans le code frontend ou le dépôt.
8.  **Données :** ne pas stocker de grandes images ou documents
    directement on-chain.
9.  **Interface :** ne pas simuler une transaction réussie avant
    confirmation réelle de la blockchain.
10. **Erreurs :** présenter des messages compréhensibles pour les
    erreurs utilisateur, réseau, contrat et portefeuille.
11. **Tests :** écrire des tests automatisés pour les scénarios positifs
    et négatifs.
12. **Reproductibilité :** documenter les commandes d'installation,
    compilation, test et déploiement.
13. **Réseau :** le prototype doit fonctionner localement sur Ganache,
    sans dépendre d'un réseau public.
14. **Versions :** fixer les versions de Solidity, Truffle, OpenZeppelin
    et des dépendances.
15. **Pas de fausses données :** les chiffres affichés comme données
    blockchain doivent réellement provenir des contrats ou des
    événements.

------------------------------------------------------------------------

# 11. Limites et choix de conception à documenter

-   Le prototype utilise Ganache : les tokens et transactions sont
    destinés à la démonstration académique, sans valeur financière
    réelle.
-   Le FT est un mécanisme de récompense. Il ne représente pas une
    monnaie, un paiement réel ou une quantité physique de produits.
-   Le NFT identifie un lot, mais ne certifie pas à lui seul la qualité,
    la fraîcheur ou l'origine physique du produit.
-   Les données personnelles et documents confidentiels ne doivent pas
    être stockés directement sur la blockchain.
-   Les données saisies par les acteurs doivent être considérées comme
    des déclarations, sauf si un mécanisme externe de vérification est
    ajouté.
-   Le prototype doit privilégier un workflow métier compréhensible et
    démontrable plutôt que des fonctionnalités nombreuses mais
    inachevées.

------------------------------------------------------------------------

# 12. Livrables finaux attendus

## Livrables de développement

-   [ ] `FoodChainToken.sol` --- contrat ERC-20 développé par Karim.
-   [ ] `FoodBatchNFT.sol` --- contrat ERC-721 développé par Nesrine.
-   [ ] Scripts Truffle de migration et de déploiement.
-   [ ] Configuration Ganache / Truffle documentée.
-   [ ] Tests unitaires des deux contrats.
-   [ ] Tests d'intégration FT + NFT.
-   [ ] Frontend connecté à MetaMask.
-   [ ] Dashboard et pages de gestion des lots.
-   [ ] Consultation de l'historique blockchain.
-   [ ] Affichage des soldes et récompenses FCT.
-   [ ] README avec installation, lancement, tests et déploiement.
-   [ ] Captures d'écran et scénario de démonstration.

## Critères d'acceptation

Le projet est considéré comme fonctionnel lorsque :

1.  Les deux contrats sont compilés et déployés sur Ganache.
2.  Le contrat FT respecte ERC-20 et permet une distribution contrôlée
    des récompenses.
3.  Le contrat NFT respecte ERC-721 et crée un NFT unique par lot.
4.  Les étapes du cycle de vie d'un lot sont enregistrées et
    consultables.
5.  Le contrat NFT peut déclencher une récompense FT selon les règles
    prévues.
6.  Les comptes non autorisés ne peuvent pas exécuter les opérations
    protégées.
7.  Le frontend permet de connecter MetaMask et d'effectuer les
    opérations réelles.
8.  Les tests couvrent les scénarios normaux, les erreurs et les
    tentatives non autorisées.
9.  Le projet peut être installé, lancé et démontré en suivant
    uniquement le README.

------------------------------------------------------------------------

# 13. Instructions précises pour l'agent IA

Tu es un ingénieur blockchain senior spécialisé en Solidity, Ethereum,
Truffle, Ganache, MetaMask et développement de DApps.

Ta mission est de concevoir et réaliser **AnOps FoodChain**, une
application de traçabilité de la supply chain alimentaire pour les
fruits et légumes frais.

Tu dois impérativement respecter les décisions suivantes :

-   Le projet possède exactement deux smart contracts principaux
    développés par les deux membres.
-   Karim est responsable du contrat FT ERC-20 `FoodChainToken.sol`.
-   Nesrine est responsable du contrat NFT ERC-721 `FoodBatchNFT.sol`.
-   Les deux contrats doivent être complémentaires et interconnectés.
-   Le NFT représente le passeport numérique d'un lot alimentaire.
-   Le FT représente des points de récompense attribués aux acteurs pour
    des opérations validées.
-   L'application doit utiliser Node.js, Truffle, Ganache et MetaMask.
-   Le frontend doit interagir réellement avec les contrats déployés.
-   Le réseau cible du prototype est Ganache local.

## Méthode de travail obligatoire

1.  Commencer par analyser le cahier des charges et proposer une
    architecture technique concise.
2.  Définir précisément les structures de données, rôles, statuts,
    fonctions et événements des deux contrats.
3.  Vérifier la compatibilité des versions Solidity, Truffle et
    OpenZeppelin avant d'écrire le code.
4.  Développer les contrats séparément, avec des responsabilités bien
    délimitées.
5.  Ajouter les migrations Truffle dans le bon ordre : FT puis NFT.
6.  Ajouter l'autorisation du contrat NFT dans le contrat FT.
7.  Écrire et exécuter les tests unitaires et d'intégration.
8.  Corriger les erreurs avant de commencer l'intégration frontend.
9.  Développer une interface professionnelle, responsive, accessible et
    cohérente.
10. Connecter MetaMask, vérifier le réseau et afficher les résultats
    réels des transactions.
11. Tester le scénario complet de démonstration.
12. Documenter toutes les commandes et les étapes nécessaires pour
    reproduire le projet.

## Contraintes de réalisation

-   Ne pas remplacer Ganache/Truffle par Hardhat ou un autre framework.
-   Ne pas remplacer ERC-20 par un token personnalisé non standard.
-   Ne pas remplacer ERC-721 par une simple table de données ou un faux
    NFT.
-   Ne pas créer de fausses transactions ou de statistiques statiques
    présentées comme blockchain.
-   Ne pas ajouter de complexité inutile, de tokenomics spéculative ou
    de fonctionnalités hors périmètre.
-   Ne pas considérer qu'une donnée est vraie simplement parce qu'elle
    est enregistrée sur la blockchain.
-   Ne pas terminer après avoir généré les fichiers : compiler,
    déployer, tester et corriger réellement le projet.
-   Ne pas affirmer qu'une étape est terminée si elle n'a pas été
    vérifiée par une commande ou un test.

**Résultat final attendu :** une DApp académique complète, fonctionnelle
et démontrable, avec un FT ERC-20 développé par Karim, un NFT ERC-721
développé par Nesrine, leur interaction sur Ganache, et un frontend
connecté à MetaMask permettant de suivre un lot alimentaire de sa
création jusqu'à sa livraison finale.

------------------------------------------------------------------------

# 14. Références techniques officielles

-   Solidity documentation : https://docs.soliditylang.org/
-   OpenZeppelin Contracts : https://docs.openzeppelin.com/contracts/
-   ERC-20 standard : https://eips.ethereum.org/EIPS/eip-20
-   ERC-721 standard : https://eips.ethereum.org/EIPS/eip-721
-   Truffle documentation : https://archive.trufflesuite.com/docs/
-   Ganache documentation :
    https://archive.trufflesuite.com/docs/ganache/
-   MetaMask documentation : https://docs.metamask.io/
-   ethers.js documentation : https://docs.ethers.org/
