import Anthropic from '@anthropic-ai/sdk';
import { Goal, SubGoal } from '../types';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true, // Required for client-side usage
});

interface ExerciseSuggestionContext {
  goal: Goal;
  subGoal?: SubGoal;
  completedSubGoals?: SubGoal[];
}

/**
 * Generates a practice exercise suggestion using Claude Haiku.
 * @param context - The current practice context including goal, sub-goal, and history
 * @returns A one-sentence exercise suggestion
 */
export async function generateExerciseSuggestion(
  context: ExerciseSuggestionContext
): Promise<string> {
  const { goal, subGoal, completedSubGoals = [] } = context;

  // Build the prompt based on available context
  const prompt = buildExercisePrompt(goal, subGoal, completedSubGoals);

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
        {
          role: 'assistant',
          content: 'Exercise suggestion:',
        },
      ],
    });

    // Extract the text from the response
    const content = message.content[0];
    if (content.type === 'text') {
      // The response should start with our prefill, so we combine them
      return 'Exercise suggestion:' + content.text.trim();
    }

    return 'Unable to generate suggestion at this time.';
  } catch (error) {
    console.error('Error generating exercise suggestion:', error);
    return 'Unable to generate suggestion. Please try again.';
  }
}

/**
 * Exercise knowledge base - categories of piano practice techniques
 */
// const EXERCISE_KNOWLEDGE_BASE = `
// You have access to these proven piano practice techniques that you can adapt to specific situations:

// FINGER INDEPENDENCE:
// - Scales in contrary motion
// - Scales in one hand while comping with the other with different rhythm
// - Scales with different dynamics or articulation in each hand

// PLAYING THIRDS:
// - Scales in thirds (diatonic and chromatic)
// - Loop the specific difficult passage

// FAST PASSAGES:
// - Burst Practice: 4 notes of the run as fast as possible, pause, repeat
// - Tempo Displacement: Practice passage at 150% target tempo, but as eighths instead of sixteenths
// - Taubman Approach: Rotation Exercises

// AWKWARD FINGERING PATTERNS:
// - Fingering Isolation: Play ONLY with the fingering pattern on a table or closed piano lid
// - Note Grouping by Fingering: If fingering is 1-2-3-1-2-3-4-5, practice 1-2-3 separately, then 1-2-3-4-5

// ARPEGGIOS:
// - Arpeggios in all inversions, up to 4 octaves
// - 7th chord arpeggios
// - Blocked-to-Broken Chord Exercise: Block the arpeggio notes as a chord, then play broken

// EXPRESSIVENESS:
// - Exaggerated Dynamics
// - Separate touch exercise: Play melody legato/singing, accompaniment staccato/light
// - Sing the melody while playing accompaniment
// - Chord Voicing Exercise: Play a 4-note chord, bring out each voice separately (4 playthroughs)

// PLAYING LIGHTLY:
// - Feather Touch Scales
// - Staccato Octaves at pp

// CHORD PROGRESSIONS:
// - Position Mapping: Play first chord, lift hands completely off, find second chord by feel (no looking)
// - Slow-Motion Choreography: Execute the hand movements at 25% speed, focusing on the arc/path of the jump
// - Chord Blocking Exercise: Reduce the passage to blocked chords only (remove passing notes/decoration)
// - Alberti/Broken Chord to Block: If passage is broken chords, block them first

// REPEATED NOTES/CHORDS:
// - Single-Finger Repetition
// - Finger Substitution Technique: Rapid repetitions using alternating fingers (e.g., 3-2-1-2-3 on same note)
// - Wrist Staccato Exercise: Chord repeated using wrist rotation/bounce, not individual finger pressure

// TRILLS:
// - Two-Note Trill Pattern: Alternate two adjacent fingers on two notes (2-3, 3-4, 4-5 most common)
// - Trill with Other Fingers Held Down: Hold 1-2 down, trill 3-4. Or hold 1-2-3, trill 4-5
// - Measured Trill Exercise: Trill with exact number of alternations (4, 6, 8, 12 notes)

// SIGHT READING:
// - Sight read 1-2 pages of new music below your performance level without stopping, with metronome
// - Interval Recognition Drills: Flash cards or apps for instant interval recognition
// - Simplified Texture Sight Reading: Reduce complex passages to essential notes (melody + bass)

// RHYTHM:
// - Subdivide and Count Aloud: Count the smallest subdivision while playing
// - Polyrhythm Isolation: 3 against 2 (RH plays 3 notes, LH plays 2 notes in same time span)
// - Say "pass the goddamn butter" for natural 3-over-2, then remove words
// - Try 4 against 3, 5 against 4, etc. Each has its own mnemonic
// - Rhythm-Only Practice: Tap the rhythm on closed lid/table before playing notes

// HAND RHYTHM INDEPENDENCE:
// - Polyrhythm Building Blocks: Start with 2-against-3, 3-against-4, then more complex patterns
// - One hand legato, other staccato, on same rhythm

// MEMORIZATION:
// - Section Memorization: Memorize 4-8 bars at a time, then test yourself without score
// - Multi-Modal Memory: Memorize multiple ways (visual/photographic, aural/by ear, kinesthetic/muscle, analytical/harmony)
// - Practice Starting from Different Points: Start in middle, end, random bars

// PERFORMANCE:
// - Simulated Performance: Record yourself, play for stuffed animals, family, anyone
// - Mental Practice: "Play" piece in your head, away from piano, with full detail

// EAR TRAINING:
// - Scale-to-Chord Matching: For each chord (Cmaj7, Dm7, etc.), practice its corresponding scale/mode
// - Simple Melody Transcription
// - Bass line addition: Once you can play melody, add basic bass line (roots of chords)
// - Chord ear training: Learn to recognize major, minor, diminished, augmented by ear

// IMPROVISATION:
// - Blues Scale Improvisation: Learn blues scale (C blues: C-Eb-F-Gb-G-Bb-C), improvise over 12-bar blues

// TONE:
// - Single Note Focus: Play one note, focus entirely on its quality. How did it speak? Was attack harsh? Experiment with different arm weights, touch speeds. Record and listen.
// - Phrase Shaping: Identify the peak of each phrase, plan crescendo to it and dim away
// `.trim();

/**
 * Builds a detailed prompt for the LLM based on practice context
 */
function buildExercisePrompt(
  goal: Goal,
  subGoal?: SubGoal,
  completedSubGoals: SubGoal[] = []
): string {
  // let prompt = EXERCISE_KNOWLEDGE_BASE + '\n\n';

  let prompt = 'Provide a specific, actionable piano practice exercise for the following goal:\n\n';

  // Add goal information
  prompt += `Goal: ${goal.name}\n`;
  if (goal.type !== 'piece') {
    prompt += `Type: ${goal.type}\n`;
  }
  if (goal.targetBpm) {
    prompt += `Target BPM: ${goal.targetBpm}\n`;
  }

  // Add technical/focus information
  if (goal.technicalDescription) {
    prompt += `Description: ${goal.technicalDescription}\n`;
  }
  if (goal.earTrainingFocus && goal.earTrainingFocus.length > 0) {
    prompt += `Focus: ${goal.earTrainingFocus.join(', ')}\n`;
  }
  if (goal.eyeTrainingFocus && goal.eyeTrainingFocus.length > 0) {
    prompt += `Focus: ${goal.eyeTrainingFocus.join(', ')}\n`;
  }

  // Add sub-goal information if present
  if (subGoal) {
    prompt += `\nCurrent sub-goal: ${subGoal.name}\n`;
    if (subGoal.noteHistory && subGoal.noteHistory.length > 0) {
      // Get the most recent note
      const recentNote = subGoal.noteHistory[0];
      prompt += `Recent note on this sub-goal: ${recentNote.note}\n`;
    }
  } else if (goal.noteHistory && goal.noteHistory.length > 0) {
    // If no sub-goal, use goal-level notes
    const recentNote = goal.noteHistory[0];
    prompt += `Recent note: ${recentNote.note}\n`;
  }

  // Add completed sub-goals for context
  if (completedSubGoals.length > 0) {
    prompt += `\nCompleted sub-goals:\n`;
    completedSubGoals.forEach((sg) => {
      prompt += `- ${sg.name}\n`;
    });
  }

  prompt += '\nProvide ONE specific, actionable practice exercise (1 sentence) that will help achieve this goal. ';
  // prompt += 'Draw from the techniques above but adapt them to this specific context. ';
  prompt += 'Focus on concrete techniques or approaches. Do not include any preamble or explanation, just the exercise itself.';

  return prompt;
}
