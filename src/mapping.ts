import _ from 'lodash';

export const COLUMN_MAP: Record<string, string | null> = {
  '네임스페이스': 'namespace',
  '번역 키': 'key',
  '유형': 'suffix',
  '사용여부': 'used',
  '한국어': 'ko',
  '일본어': 'ja',
  '영어': 'en',
  '생성일': 'created_at',
};

export const SUFFIX_MAP: Record<string, string | null> = {
  '단수': 'one',
  '복수': 'other',
  // NOTE: 아랍어의 경우에는 복수형이 5개 존재하는데, 만약 아랍어를 지원하고자 하는 경우
  // 여기에 zero, one, two, few, many, other 와 같이 정의가 필요합니다.
  '남성': 'male',
  '여성': 'female',
};
export const SUFFIX_MAP_REV: Record<string, string | null> = _.invert(SUFFIX_MAP);
