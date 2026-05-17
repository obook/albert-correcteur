/*
 * personas.js - Personas de reformulation (destinataires types).
 *
 * Chaque persona décrit un ton à appliquer lors de la reformulation
 * d'un texte. Le champ `tone` est injecté tel quel dans le prompt
 * système de reformulation à la place du placeholder
 * {{PERSONA_TONE}} (cf. prompts/reformulation.txt et
 * service-prompts.js::buildPrompt).
 *
 * Le champ `example` est uniquement à usage UI : il sert à montrer à
 * l'utilisateur ce que produit le persona avant qu'il ne reformule
 * son propre texte. Tous les exemples reformulent la même phrase
 * source pour permettre la comparaison entre personas.
 *
 * Pour ajouter un persona :
 *   1. Ajouter une entrée dans PERSONAS ci-dessous.
 *   2. Id en kebab-case sans accent (sert de clé storage et de
 *      suffixe d'id de menu contextuel).
 *   3. Le champ `tone` doit décrire registre, vouvoiement/tutoiement,
 *      éléments à éviter, et structure attendue le cas échéant.
 *
 * Source de vérité unique partagée entre service worker et UI.
 * Chargée :
 *   - dans le service worker via manifest.background.scripts
 *   - dans les popup HTML via <script src="...">
 *
 * Inspiration : idée et structure des personas reprises du projet
 * Scribéo-mail d'Emmanuel Gaunard (DRANE Grenoble),
 * https://forge.apps.education.fr/drane-grenoble/scribeo-mail
 * (fichier src/lib/personas.js). Le concept de tone injecté dans le
 * prompt et d'example affiché en UI vient de chez lui.
 *
 * Auteur : O. Booklage
 * Date : Mai 2026
 * Licence : MIT
 */

"use strict";

const PERSONAS = [
  {
    id: "neutre",
    label: "Neutre",
    description: "Reformulation standard, sans direction particulière.",
    tone: "Garde le registre et le ton du texte source. Reformule pour gagner en clarté et en fluidité, sans changer le niveau de langue ni le degré de formalisme.",
    example: "Bonjour, je souhaiterais convenir d'un rendez-vous afin de discuter du projet en cours.",
  },
  {
    id: "formel",
    label: "Formel administratif",
    description: "Courriers officiels, demandes institutionnelles.",
    tone: "Registre formel et institutionnel. Vouvoiement systématique. Formules d'usage classiques (Madame, Monsieur ; Je vous prie d'agréer...). Phrases construites, lexique soutenu, aucune familiarité. Préserver la position hiérarchique sans servilité ni excès.",
    example: "Madame, Monsieur, je sollicite par la présente un entretien afin d'évoquer l'avancement du projet en cours. Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
  },
  {
    id: "cordial",
    label: "Cordial professionnel",
    description: "Collègues, partenaires, communication entre pairs.",
    tone: "Registre cordial, direct et professionnel entre pairs. Vouvoiement par défaut (tutoiement seulement si le texte source l'utilise déjà). Ton chaleureux mais efficace, pas de formalisme excessif. Phrases naturelles, transitions fluides.",
    example: "Bonjour, je propose qu'on se cale un point ensemble dans la semaine pour faire avancer le projet. Quels créneaux vous arrangent ?",
  },
  {
    id: "pedagogique",
    label: "Pédagogique pour élève",
    description: "Adresse à un élève, langage simple et encourageant.",
    tone: "Registre simple, encourageant et motivant. Tutoiement. Phrases courtes et directes. Valoriser l'effort et la progression. Vocabulaire adapté à un public collège-lycée, sans jargon scolaire ou administratif.",
    example: "Salut, je te propose qu'on prenne un moment ensemble cette semaine pour parler du projet. Tu choisis le créneau qui t'arrange.",
  },
  {
    id: "bienveillant-parent",
    label: "Bienveillant pour parent",
    description: "Communication école-famille, ton rassurant et accessible.",
    tone: "Registre bienveillant, clair et accessible. Vouvoiement. Bannir tout jargon de l'Éducation nationale, ou l'expliciter immédiatement. Ton rassurant, factuel, posé. Préserver la relation école-famille et la confiance.",
    example: "Bonjour, afin d'échanger sur la scolarité de votre enfant, je vous propose un rendez-vous à votre convenance dans la semaine. Pourriez-vous m'indiquer deux ou trois créneaux qui vous arrangent ?",
  },
  {
    id: "concis",
    label: "Concis et factuel",
    description: "Notes courtes, comptes-rendus, mémos.",
    tone: "Registre factuel et concis. Phrases courtes, voix active, pas de circonlocutions ni de formules de politesse étoffées. Aller à l'essentiel sans devenir sec : viser l'efficacité informative.",
    example: "Bonjour, point sur le projet en cours souhaité cette semaine. Proposer un créneau.",
  },
];

const DEFAULT_PERSONA_ID = "neutre";

/**
 * Renvoie le persona correspondant à l'id, ou le persona par défaut
 * (neutre) si l'id est inconnu, vide ou nul.
 *
 * @param {string} id - Id de persona (kebab-case).
 * @returns {{id: string, label: string, description: string, tone: string, example: string}}
 */
function getPersonaById(id) {
  if (!id) return PERSONAS[0];
  const found = PERSONAS.find((p) => p.id === id);
  return found || PERSONAS[0];
}
