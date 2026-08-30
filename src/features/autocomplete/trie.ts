import dictionaryJson from './data/chosung_words.json?raw';
import { isSupportedChosungSequence } from './chosung';
import { createChosungWord, HOSPITAL_SOURCE, type ChosungWord } from './models';

export const DICTIONARY_SCHEMA_VERSION = 1;
export const DICTIONARY_LANGUAGE = 'ko';
export const MAX_CACHED_CANDIDATES = 20;

interface CompactDictionaryPayload {
  schema_version?: unknown;
  language?: unknown;
  word_count?: unknown;
  words?: unknown;
}

export class ChosungDictionaryError extends Error {
  constructor(detail: string) {
    super(`invalid Chosung dictionary: ${detail}`);
    this.name = 'ChosungDictionaryError';
  }
}

export class TrieNode {
  readonly children = new Map<string, TrieNode>();
  readonly cachedCandidates: ChosungWord[] = [];
}

function compareWords(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function compareCandidates(left: ChosungWord, right: ChosungWord): number {
  return right.priority - left.priority || left.rank - right.rank || compareWords(left.word, right.word);
}

function preferDuplicate(existing: ChosungWord, candidate: ChosungWord): ChosungWord {
  if (existing.source !== candidate.source) {
    if (candidate.source === HOSPITAL_SOURCE) return candidate;
    if (existing.source === HOSPITAL_SOURCE) return existing;
  }
  return compareCandidates(candidate, existing) < 0 ? candidate : existing;
}

export function loadChosungWords(rawJson: string = dictionaryJson): readonly ChosungWord[] {
  let payload: CompactDictionaryPayload;
  try {
    payload = JSON.parse(rawJson) as CompactDictionaryPayload;
  } catch {
    throw new ChosungDictionaryError('top-level value is not valid JSON');
  }

  if (payload.schema_version !== DICTIONARY_SCHEMA_VERSION) {
    throw new ChosungDictionaryError(`schema_version must be ${DICTIONARY_SCHEMA_VERSION}`);
  }
  if (payload.language !== DICTIONARY_LANGUAGE) {
    throw new ChosungDictionaryError(`language must be ${DICTIONARY_LANGUAGE}`);
  }
  if (!Array.isArray(payload.words)) throw new ChosungDictionaryError('words must be an array');
  if (payload.word_count != null && payload.word_count !== payload.words.length) {
    throw new ChosungDictionaryError('word_count does not match words array');
  }

  const words: ChosungWord[] = [];
  const seenWords = new Set<string>();
  let previousFrequency: number | null = null;

  payload.words.forEach((rawEntry, index) => {
    if (!Array.isArray(rawEntry) || rawEntry.length !== 4) {
      throw new ChosungDictionaryError(`words[${index}] must be a compact four-item array`);
    }
    const [word, chosung, freq, rank] = rawEntry;
    let candidate: ChosungWord;
    try {
      candidate = createChosungWord({ word, chosung, freq, rank });
    } catch (error) {
      throw new ChosungDictionaryError(`words[${index}] ${error instanceof Error ? error.message : String(error)}`);
    }
    if (candidate.rank !== index + 1) {
      throw new ChosungDictionaryError('ranks must be contiguous, one-based, and match array order');
    }
    if (previousFrequency !== null && candidate.freq > previousFrequency) {
      throw new ChosungDictionaryError('frequencies must be in non-increasing order');
    }
    if (seenWords.has(candidate.word)) throw new ChosungDictionaryError(`duplicate word: ${candidate.word}`);

    words.push(candidate);
    seenWords.add(candidate.word);
    previousFrequency = candidate.freq;
  });

  return words;
}

export class ChosungTrie {
  readonly root = new TrieNode();
  nodeCount = 1;
  maxCachedCandidates = 0;

  insert(candidate: ChosungWord): void {
    let node = this.root;
    for (const edge of candidate.chosung) {
      if (!isSupportedChosungSequence(edge)) throw new Error(`unsupported Chosung edge: ${edge}`);
      let child = node.children.get(edge);
      if (!child) {
        child = new TrieNode();
        node.children.set(edge, child);
        this.nodeCount += 1;
      }
      node = child;
      this.cacheCandidate(node, candidate);
    }
  }

  private cacheCandidate(node: TrieNode, candidate: ChosungWord): void {
    const existingIndex = node.cachedCandidates.findIndex((existing) => existing.word === candidate.word);
    if (existingIndex >= 0) {
      const existing = node.cachedCandidates[existingIndex];
      const preferred = preferDuplicate(existing, candidate);
      if (preferred === existing) return;
      node.cachedCandidates[existingIndex] = preferred;
    } else {
      node.cachedCandidates.push(candidate);
    }

    node.cachedCandidates.sort(compareCandidates);
    node.cachedCandidates.splice(MAX_CACHED_CANDIDATES);
    this.maxCachedCandidates = Math.max(this.maxCachedCandidates, node.cachedCandidates.length);
  }

  static fromWords(words: Iterable<ChosungWord>): ChosungTrie {
    const trie = new ChosungTrie();
    for (const word of words) trie.insert(word);
    return trie;
  }

  query(prefix: unknown, limit: number = MAX_CACHED_CANDIDATES): ChosungWord[] {
    if (!isSupportedChosungSequence(prefix) || !Number.isInteger(limit) || limit <= 0) return [];

    let node = this.root;
    for (const edge of prefix) {
      const child = node.children.get(edge);
      if (!child) return [];
      node = child;
    }

    return node.cachedCandidates.slice(0, Math.min(limit, MAX_CACHED_CANDIDATES));
  }
}
