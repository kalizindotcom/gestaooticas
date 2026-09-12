import { FinancialEntry } from '@/types';

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  balance_after?: number;
  matched_entry_id?: string;
  match_confidence?: number;
  is_reconciled: boolean;
}

export interface MatchResult {
  transaction: BankTransaction;
  entry: FinancialEntry | null;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'manual' | 'none';
  reasons: string[];
}

export interface ReconciliationSummary {
  totalTransactions: number;
  matchedAuto: number;
  matchedManual: number;
  pending: number;
  matchRate: number;
  discrepancies: Array<{
    transaction: BankTransaction;
    expectedAmount?: number;
    actualAmount: number;
    difference: number;
  }>;
}

export class ReconciliationMatcher {
  private static readonly EXACT_MATCH_THRESHOLD = 100;
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 85;
  private static readonly MEDIUM_CONFIDENCE_THRESHOLD = 60;

  static matchTransactions(
    transactions: BankTransaction[],
    entries: FinancialEntry[]
  ): MatchResult[] {
    const results: MatchResult[] = [];
    const unmatchedEntries = [...entries];

    for (const transaction of transactions) {
      if (transaction.is_reconciled && transaction.matched_entry_id) {
        const matchedEntry = entries.find(e => e.id === transaction.matched_entry_id);
        results.push({
          transaction,
          entry: matchedEntry || null,
          confidence: 100,
          matchType: 'manual',
          reasons: ['Conciliação manual confirmada'],
        });
        continue;
      }

      const match = this.findBestMatch(transaction, unmatchedEntries);
      results.push(match);

      if (match.entry && match.confidence >= this.MEDIUM_CONFIDENCE_THRESHOLD) {
        const index = unmatchedEntries.findIndex(e => e.id === match.entry!.id);
        if (index !== -1) unmatchedEntries.splice(index, 1);
      }
    }

    return results;
  }

  private static findBestMatch(
    transaction: BankTransaction,
    entries: FinancialEntry[]
  ): MatchResult {
    let bestMatch: MatchResult = {
      transaction,
      entry: null,
      confidence: 0,
      matchType: 'none',
      reasons: [],
    };

    for (const entry of entries) {
      const result = this.calculateMatch(transaction, entry);
      if (result.confidence > bestMatch.confidence) {
        bestMatch = result;
      }
    }

    return bestMatch;
  }

  private static calculateMatch(
    transaction: BankTransaction,
    entry: FinancialEntry
  ): MatchResult {
    const reasons: string[] = [];
    let confidence = 0;

    // 1. Verificar valor (peso: 40%)
    const amountMatch = this.matchAmount(transaction, entry);
    confidence += amountMatch.score;
    if (amountMatch.matched) reasons.push(amountMatch.reason);

    // 2. Verificar data (peso: 30%)
    const dateMatch = this.matchDate(transaction, entry);
    confidence += dateMatch.score;
    if (dateMatch.matched) reasons.push(dateMatch.reason);

    // 3. Verificar descrição (peso: 20%)
    const descMatch = this.matchDescription(transaction, entry);
    confidence += descMatch.score;
    if (descMatch.matched) reasons.push(descMatch.reason);

    // 4. Verificar tipo (peso: 10%)
    const typeMatch = this.matchType(transaction, entry);
    confidence += typeMatch.score;
    if (typeMatch.matched) reasons.push(typeMatch.reason);

    const matchType = confidence >= this.EXACT_MATCH_THRESHOLD
      ? 'exact'
      : confidence >= this.MEDIUM_CONFIDENCE_THRESHOLD
      ? 'fuzzy'
      : 'none';

    return {
      transaction,
      entry: confidence >= this.MEDIUM_CONFIDENCE_THRESHOLD ? entry : null,
      confidence,
      matchType,
      reasons,
    };
  }

  private static matchAmount(transaction: BankTransaction, entry: FinancialEntry) {
    const txAmount = Math.abs(transaction.amount);
    const entryAmount = entry.amount;
    const diff = Math.abs(txAmount - entryAmount);
    const percentDiff = (diff / entryAmount) * 100;

    if (diff === 0) {
      return { matched: true, score: 40, reason: 'Valor exato' };
    } else if (percentDiff <= 1) {
      return { matched: true, score: 35, reason: 'Valor muito próximo (< 1%)' };
    } else if (percentDiff <= 5) {
      return { matched: true, score: 25, reason: 'Valor próximo (< 5%)' };
    } else if (percentDiff <= 10) {
      return { matched: false, score: 15, reason: 'Valor com diferença moderada' };
    }

    return { matched: false, score: 0, reason: 'Valor não corresponde' };
  }

  private static matchDate(transaction: BankTransaction, entry: FinancialEntry) {
    const txDate = new Date(transaction.transaction_date);
    const entryDate = new Date(entry.payment_date || entry.due_date);
    const diffDays = Math.abs(
      (txDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return { matched: true, score: 30, reason: 'Data exata' };
    } else if (diffDays <= 2) {
      return { matched: true, score: 25, reason: 'Data próxima (±2 dias)' };
    } else if (diffDays <= 5) {
      return { matched: true, score: 18, reason: 'Data próxima (±5 dias)' };
    } else if (diffDays <= 10) {
      return { matched: false, score: 10, reason: 'Data com diferença moderada' };
    }

    return { matched: false, score: 0, reason: 'Data não corresponde' };
  }

  private static matchDescription(transaction: BankTransaction, entry: FinancialEntry) {
    const txDesc = this.normalizeText(transaction.description);
    const entryDesc = this.normalizeText(entry.description || '');
    const entryName = this.normalizeText(entry.supplier_customer_name || '');

    // Verificar correspondência exata
    if (txDesc === entryDesc || txDesc === entryName) {
      return { matched: true, score: 20, reason: 'Descrição exata' };
    }

    // Verificar palavras-chave comuns
    const txWords = txDesc.split(/\s+/);
    const entryWords = [...entryDesc.split(/\s+/), ...entryName.split(/\s+/)];
    const commonWords = txWords.filter(w => w.length > 3 && entryWords.includes(w));

    if (commonWords.length >= 3) {
      return { matched: true, score: 18, reason: 'Múltiplas palavras em comum' };
    } else if (commonWords.length >= 2) {
      return { matched: true, score: 12, reason: 'Algumas palavras em comum' };
    } else if (commonWords.length >= 1) {
      return { matched: false, score: 6, reason: 'Poucas palavras em comum' };
    }

    // Verificar similaridade por Levenshtein simplificado
    const similarity = this.calculateSimilarity(txDesc, entryDesc);
    if (similarity > 0.7) {
      return { matched: true, score: 15, reason: 'Descrição similar' };
    } else if (similarity > 0.5) {
      return { matched: false, score: 8, reason: 'Descrição parcialmente similar' };
    }

    return { matched: false, score: 0, reason: 'Descrição não corresponde' };
  }

  private static matchType(transaction: BankTransaction, entry: FinancialEntry) {
    const isCredit = transaction.type === 'credit';
    const isIncome = entry.type === 'receivable' || entry.type === 'in';

    if ((isCredit && isIncome) || (!isCredit && !isIncome)) {
      return { matched: true, score: 10, reason: 'Tipo correspondente' };
    }

    return { matched: false, score: 0, reason: 'Tipo não corresponde' };
  }

  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  static generateSummary(matches: MatchResult[]): ReconciliationSummary {
    const totalTransactions = matches.length;
    const matchedAuto = matches.filter(
      m => m.matchType === 'exact' || m.matchType === 'fuzzy'
    ).length;
    const matchedManual = matches.filter(m => m.matchType === 'manual').length;
    const pending = matches.filter(m => m.matchType === 'none').length;
    const matchRate = totalTransactions > 0
      ? ((matchedAuto + matchedManual) / totalTransactions) * 100
      : 0;

    const discrepancies = matches
      .filter(m => m.entry && m.confidence < this.HIGH_CONFIDENCE_THRESHOLD)
      .map(m => ({
        transaction: m.transaction,
        expectedAmount: m.entry?.amount,
        actualAmount: Math.abs(m.transaction.amount),
        difference: m.entry
          ? Math.abs(Math.abs(m.transaction.amount) - m.entry.amount)
          : 0,
      }));

    return {
      totalTransactions,
      matchedAuto,
      matchedManual,
      pending,
      matchRate,
      discrepancies,
    };
  }

  static parseOFX(ofxContent: string): BankTransaction[] {
    // Implementação simplificada de parser OFX
    // Em produção, usar biblioteca como 'ofx-js'
    const transactions: BankTransaction[] = [];
    const lines = ofxContent.split('\n');

    let currentTx: Partial<BankTransaction> = {};

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('<STMTTRN>')) {
        currentTx = { is_reconciled: false };
      } else if (trimmed.startsWith('</STMTTRN>')) {
        if (currentTx.transaction_date && currentTx.amount !== undefined && Number.isFinite(currentTx.amount)) {
          transactions.push(currentTx as BankTransaction);
        }
        currentTx = {};
      } else if (trimmed.startsWith('<DTPOSTED>')) {
        const date = trimmed.match(/<DTPOSTED>(\d{8})/)?.[1];
        if (date) {
          currentTx.transaction_date = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
        }
      } else if (trimmed.startsWith('<TRNAMT>')) {
        const amount = this.parseAmount(trimmed.match(/<TRNAMT>([^<]+)/)?.[1]);
        currentTx.amount = amount;
        currentTx.type = amount >= 0 ? 'credit' : 'debit';
      } else if (trimmed.startsWith('<MEMO>')) {
        currentTx.description = trimmed.match(/<MEMO>(.+)/)?.[1] || '';
      }
    }

    return transactions;
  }

  static parseCSV(csvContent: string, format: 'standard' | 'itau' | 'bradesco' | 'bb'): BankTransaction[] {
    const lines = csvContent.split('\n').filter(l => l.trim());
    const transactions: BankTransaction[] = [];

    // Pular cabeçalho
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
      const cols = this.splitCsvLine(line);

      let transaction: Partial<BankTransaction> = { is_reconciled: false };

      switch (format) {
        case 'itau':
          transaction.transaction_date = this.parseDate(cols[0]);
          transaction.description = cols[1];
          transaction.amount = this.parseAmount(cols[2]);
          transaction.type = transaction.amount >= 0 ? 'credit' : 'debit';
          break;
        case 'bradesco':
          transaction.transaction_date = this.parseDate(cols[0]);
          transaction.description = cols[2];
          transaction.amount = this.parseAmount(cols[3]);
          transaction.type = cols[1]?.trim().toUpperCase() === 'C' ? 'credit' : 'debit';
          break;
        case 'bb':
          transaction.transaction_date = this.parseDate(cols[0]);
          transaction.description = cols[3];
          transaction.amount = this.parseAmount(cols[4]);
          transaction.type = transaction.amount >= 0 ? 'credit' : 'debit';
          break;
        default:
          transaction.transaction_date = this.parseDate(cols[0]);
          transaction.description = cols[1];
          transaction.amount = this.parseAmount(cols[2]);
          transaction.type = transaction.amount >= 0 ? 'credit' : 'debit';
      }

      if (transaction.transaction_date && transaction.amount !== undefined && Number.isFinite(transaction.amount)) {
        transactions.push(transaction as BankTransaction);
      }
    }

    return transactions;
  }

  private static splitCsvLine(line: string): string[] {
    const delimiter = line.includes(';') ? ';' : ',';
    const columns: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === delimiter && !quoted) {
        columns.push(current.trim());
        current = '';
      } else {
        current += character;
      }
    }
    columns.push(current.trim());
    return columns;
  }

  private static parseAmount(value: string | undefined): number {
    const raw = String(value || '').trim().replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
    if (!raw) return NaN;
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    const normalized = lastComma > lastDot
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
    return Number(normalized);
  }

  private static parseDate(dateStr: string): string {
    // Tentar vários formatos
    const formats = [
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0] || format === formats[2]) {
          return `${match[3]}-${match[2]}-${match[1]}`;
        } else {
          return `${match[1]}-${match[2]}-${match[3]}`;
        }
      }
    }

    return dateStr;
  }
}
