# i18next-google-sheet
i18next 구글 스프레드시트 동기화 도구

i18next에서 사용하는 locales 디렉토리와 구글 스프레드시트를 동기화해주는 프로그램입니다.
[i18next-parser](https://github.com/i18next/i18next-parser)에서 생성된 JSON을 토대로
스프레드시트에 새로운 번역 항목을 추가하고, 스프레드시트에 번역된 문자열을 JSON으로 다시 가져오도록
동기화해서, 스프레드시트에서 번역 작업이 일어날 수 있도록 도와줍니다.

## 사용법
아래와 같은 방법으로 사용할 수 있습니다.

### 스프레드시트 생성
먼저, 번역에 사용할 새 스프레드시트를 생성합니다 ([sheets.new](https://sheets.new))

시트 이름을 자유롭게 지정하고, 1번째 행에 시트에서 사용할 컬럼들을 입력합니다.
- 네임스페이스
- 번역 키
- 유형
- 사용여부
- 한국어
- 일본어
- 영어
- 생성일
- 메모

사용 가능한 컬럼 이름은 [여기](./src/mapping.ts)에서 찾아보실 수 있습니다. 한국어로 쓰지 않고
코드에서 사용하는 이름 (ko, en, ja) 그대로 사용해도 괜찮습니다.

1번째 행은 시트로 고정되고, 2번째 행부터는 실제로 번역 문자열들이 추가되게 됩니다.

스프레드시트 ID를 i18next-google-sheet에 따로 전달해야 하는데요, 스프레드시트 페이지에 접속했을
때 URL이
`https://docs.google.com/spreadsheets/d/abcdefg12345678/edit#gid=0` 과 같이 되어 있는데,
여기서 `abcdefg12345678` 이 스프레드시트 ID입니다.

### 스프레드시트 범위 입력
i18next-google-sheet는 시트에서 번역 문자열을 인식할 범위를 따로 입력받도록 하고 있습니다.

- 시트1의 모든 행을 인식하고 싶다면 `--range 시트1` 같이 지정하면 됩니다.
- 시트 이름에 띄어쓰기가 들어갔다면 `--range "'시트 이름'"`과 같이 ' 로 덮어쓰면 됩니다.
- 시트1의 2번째 행부터 인식하고 싶다면 `--range "시트1!A2:Z"` 와 같은 방법으로 지정하면 됩니다.

이는 구글 시트 내부에서 범위를 지정하는 방법과 동일합니다. 시트 내부에 별다른 내용이 없다면 그대로
시트 이름만 지정해주면 됩니다.

### 구글 시트 API 키 받기
https://cloud.google.com/iam/docs/creating-managing-service-account-keys

위 문서를 참고하여 구글 시트를 접근할 수 있는 서비스 계정을 생성하고, JSON 키를 받아와야 합니다.

### i18next-parser 실행
i18next-google-sheet는 이미 생성된 locales 파일에 의존하기 때문에, i18next-parser 등의
자동화 도구를 통해 각 언어별로 필요한 locales 파일이 각자 생성되어 있어야 합니다.

### 명령줄 사용법

```
npx i18next-google-sheet --path locales/ --range "시트1" --spreadsheet-id "ABCDEFG1234567" --credentials-file ./credentials.json
```

i18next-google-sheet는 아래와 같은 파라미터를 받습니다.

- `path` - `ko/common.json` 과 같은 JSON 파일이 들어있는 locales 디렉토리
- `range` - 스프레드시트에서 데이터를 읽고 쓸 범위
- `spreadsheet-id` - 스프레드시트 고유 ID
- `credentials-file` - (택1) 구글 API 콘솔에서 받은 credentials JSON 파일 경로
- `credentials-json` - (택1) 구글 API 콘솔에서 받은 credentials JSON 본문

JSON의 경우에는 `I18NEXT_CREDENTIALS_JSON`와 같은 환경변수로도 전달할 수 있습니다.

### API 사용법

```js
import { i18nextGoogleSheet } from 'i18next-google-sheet';

const stats = await i18nextGoogleSheet({
  path: 'locales/',
  range: '시트1',
  spreadsheetId: 'ABCDEFG1234567',
  credentialsFile: './credentials.json',
});
```

stats 객체에는 아래와 같은 항목들이 포함되어 반환됩니다.

- `added`: 시트에 새로 추가된 항목
  - `count`: 영향받은 항목 개수
  - `namespaces`: 영향받은 네임스페이스 Set
  - (이하 동일)
- `updated`: 번역 파일이 업데이트된 항목
- `reused`: 번역 파일에 다시 추가되어, 시트에서 "사용 여부"가 체크 해제되었다가 다시 체크된 항목
- `pruned`: 번역 파일에서 사라져서, 시트에서 "사용 여부"가 체크 해제된 항목

i18next-google-sheet는 ESM (`type: module`)을 사용하기 때문에, 사용하는 쪽에서도 이를
감안해서 사용해야 합니다. 
