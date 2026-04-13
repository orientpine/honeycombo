#!/usr/bin/env bun

import { readdir, readFile } from 'fs/promises';
import type { Dirent } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { extname, join, relative } from 'path';

const ROOT = process.cwd();
const execFileAsync = promisify(execFile);
const DECISION_STATUS_KEYWORDS = ['제안', '승인', '폐기', '대체됨'] as const;
const EXCLUDED_DATA_DIRS = [
  'src/data/feeds',
  'src/data/trending',
] as const;
const FEATURE_REQUIRED_SECTIONS = ['개요', '동작 흐름', '관련 파일', '설정값', '제약 사항'] as const;
const DECISION_REQUIRED_SECTIONS = ['맥락', '결정', '고려한 대안', '결과'] as const;
const TROUBLESHOOTING_REQUIRED_SECTIONS = ['증상', '원인', '해결 방법', '관련 파일'] as const;

type DocType = 'feature' | 'decision' | 'troubleshooting' | 'architecture' | 'guide' | 'general';
type ValidationError = { file: string; message: string };
type CoverageWarning = { message: string };

function displayPath(filePath: string): string {
  return relative(ROOT, filePath) || filePath;
}

function getDocType(relPath: string): DocType {
  const normalizedPath = relPath.replace(/\\/g, '/');

  if (normalizedPath.startsWith('docs/features/')) {
    return 'feature';
  }

  if (normalizedPath.startsWith('docs/decisions/')) {
    return 'decision';
  }

  if (normalizedPath.startsWith('docs/troubleshooting/')) {
    return 'troubleshooting';
  }

  if (normalizedPath.startsWith('docs/architecture/')) {
    return 'architecture';
  }

  if (normalizedPath.startsWith('docs/guides/')) {
    return 'guide';
  }

  return 'general';
}

function hasHeading(content: string, heading: string): boolean {
  return content.split(/\r?\n/).some((line) => line.trim() === `## ${heading}`);
}

function validateCommonFormat(content: string): string[] {
  const missingSections: string[] = [];
  const lines = content.split(/\r?\n/);
  const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstNonEmptyIndex === -1 || !lines[firstNonEmptyIndex]?.startsWith('# ')) {
    missingSections.push('제목 (# )');
  }

  const titleIndex = firstNonEmptyIndex !== -1 && lines[firstNonEmptyIndex]?.startsWith('# ') ? firstNonEmptyIndex : -1;
  const summaryIndex = titleIndex === -1
    ? -1
    : lines.findIndex((line, index) => index > titleIndex && line.trim().length > 0);

  if (summaryIndex === -1 || !lines[summaryIndex]?.startsWith('> ')) {
    missingSections.push('요약 (> )');
  }

  if (!hasHeading(content, '관련 문서')) {
    missingSections.push('관련 문서');
  }

  if (!hasHeading(content, '변경 이력')) {
    missingSections.push('변경 이력');
  }

  return missingSections;
}

function validateFeature(content: string): string[] {
  return FEATURE_REQUIRED_SECTIONS.filter((section) => !hasHeading(content, section));
}

function validateDecision(content: string): string[] {
  const missingSections = DECISION_REQUIRED_SECTIONS.filter((section) => !hasHeading(content, section));
  const topLines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);

  if (!topLines.some((line) => DECISION_STATUS_KEYWORDS.some((keyword) => line.includes(keyword)))) {
    missingSections.push('상태 키워드 (제안/승인/폐기/대체됨)');
  }

  return missingSections;
}

function validateTroubleshooting(content: string): string[] {
  return TROUBLESHOOTING_REQUIRED_SECTIONS.filter((section) => !hasHeading(content, section));
}

function analyzeChangeCoverage(changedFiles: string[]): CoverageWarning[] {
  const normalizedFiles = changedFiles
    .map((file) => file.trim().replace(/\\/g, '/'))
    .filter((file) => file.length > 0);
  const hasDocsChanges = normalizedFiles.some((file) => file.startsWith('docs/'));
  const hasRelevantCodeChanges = normalizedFiles.some((file) => {
    if (file === 'scripts/validate-docs.ts') {
      return false;
    }

    if (EXCLUDED_DATA_DIRS.some((dir) => file.startsWith(`${dir}/`) || file === dir)) {
      return false;
    }

    return file.startsWith('src/') || file.startsWith('functions/') || file.startsWith('scripts/');
  });

  if (hasRelevantCodeChanges && !hasDocsChanges) {
    return [{ message: '코드 변경이 감지됐지만 docs/ 변경이 없습니다.' }];
  }

  return [];
}

async function scanMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = displayPath(fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (relPath === 'docs/_templates') {
        continue;
      }

      files.push(...(await scanMarkdownFiles(fullPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (relPath === 'docs/README.md') {
      continue;
    }

    if (extname(entry.name).toLowerCase() === '.md' && !entry.name.startsWith('.')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function getGitDiffFiles(baseRef?: string): Promise<string[]> {
  const args = ['diff', '--name-only', baseRef ?? 'HEAD~1'];
  const { stdout } = await execFileAsync('git', args, { cwd: ROOT });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function main(): Promise<void> {
  const docsDir = join(ROOT, 'docs');
  const markdownFiles = await scanMarkdownFiles(docsDir);
  const errors: ValidationError[] = [];

  for (const file of markdownFiles) {
    const content = await readFile(file, 'utf-8');
    const relPath = displayPath(file).replace(/\\/g, '/');
    const docType = getDocType(relPath);
    const missingSections = [...validateCommonFormat(content)];

    if (docType === 'feature') {
      missingSections.push(...validateFeature(content));
    }

    if (docType === 'decision') {
      missingSections.push(...validateDecision(content));
    }

    if (docType === 'troubleshooting') {
      missingSections.push(...validateTroubleshooting(content));
    }

    for (const section of missingSections) {
      errors.push({ file, message: `필수 항목 누락: ${section}` });
    }
  }

  if (errors.length > 0) {
    let currentFile = '';

    for (const error of errors) {
      if (error.file !== currentFile) {
        currentFile = error.file;
        console.error(`❌ ${displayPath(error.file)}`);
      }

      console.error(`  ${error.message}`);
    }

    console.error(`\n❌ 문서 검증 실패: ${markdownFiles.length}개 파일 확인`);
    process.exit(1);
  }

  if (process.argv.includes('--check-coverage')) {
    const baseRef = process.env.GITHUB_EVENT_NAME === 'pull_request' ? 'origin/master...HEAD' : undefined;
    const warnings = analyzeChangeCoverage(await getGitDiffFiles(baseRef));

    for (const warning of warnings) {
      console.error(`❌ ${warning.message}`);
    }

    if (warnings.length > 0) {
      console.error(`\n❌ 문서 커버리지 검사 실패: 코드 변경에 대응하는 docs/ 업데이트가 필요합니다.`);
      process.exit(1);
    }

    console.log('✅ 문서 변경 범위 검사 통과');
  }

  console.log(`✅ 모든 문서 유효: ${markdownFiles.length}개 파일`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate-docs.ts')) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('Unexpected error:', message);
    process.exit(1);
  });
}

export {
  analyzeChangeCoverage,
  getDocType,
  validateCommonFormat,
  validateDecision,
  validateFeature,
  validateTroubleshooting,
};
