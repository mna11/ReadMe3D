const fs = require('fs');
const path = require('path');

// GitHub API 설정
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'mna11';

// SVG 파일들 로드
const assetsDir = path.join(__dirname, 'assets');

function loadSVGContent(filename) {
    const filepath = path.join(assetsDir, filename);
    if (fs.existsSync(filepath)) {
        return fs.readFileSync(filepath, 'utf8');
    }
    return null;
}

// SVG 내용에서 내부 요소만 추출 (svg 태그 제거)
function extractSVGInner(svgContent) {
    if (!svgContent) return '';
    // SVG 태그 제거하고 내부 내용만 추출
    const match = svgContent.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    return match ? match[1] : svgContent;
}

// GitHub contribution 데이터 가져오기
async function fetchContributions() {
    const query = `
    query($username: String!) {
        user(login: $username) {
            contributionsCollection {
                contributionCalendar {
                    weeks {
                        contributionDays {
                            contributionCount
                            date
                            weekday
                        }
                    }
                }
            }
        }
    }`;

    try {
        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: { username: GITHUB_USERNAME }
            })
        });

        const data = await response.json();
        
        if (data.errors) {
            console.error('GraphQL errors:', data.errors);
            return null;
        }

        return data.data.user.contributionsCollection.contributionCalendar;
    } catch (error) {
        console.error('Error fetching contributions:', error);
        return null;
    }
}

// 최근 7일 데이터 가져오기
function getLastWeekContributions(calendar) {
    if (!calendar || !calendar.weeks) return [];
    
    const allDays = [];
    calendar.weeks.forEach(week => {
        week.contributionDays.forEach(day => {
            allDays.push(day);
        });
    });
    
    // 날짜순 정렬 후 최근 7일 (과거 -> 현재 순서)
    allDays.sort((a, b) => new Date(a.date) - new Date(b.date));
    const lastWeek = allDays.slice(-7);
    
    return lastWeek;
}

// 커밋 수에 따른 건물 타입 결정
function getBuildingType(commits) {
    if (commits === 0) return null;
    if (commits >= 1 && commits <= 3) return 'Xsmall';
    if (commits >= 4 && commits <= 6) return 'Small';
    if (commits >= 7 && commits <= 9) return 'Middle';
    return 'Big'; // 10+
}

// 요일 이름 배열
const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// 배치 위치 정의 (isometric 좌표)
// Base.svg에서 추출한 정확한 좌표
const POSITIONS = {
    // 표지판 위치 (도로 왼쪽) - 7개 슬롯 (첫번째가 왼쪽 위, 마지막이 오른쪽 아래)
    signs: [
        { x: 115, y: 284 },     // 슬롯 0
        { x: 302, y: 388 },     // 슬롯 1
        { x: 482, y: 498 },     // 슬롯 2
        { x: 680, y: 610 },     // 슬롯 3
        { x: 876, y: 728 },     // 슬롯 4
        { x: 1081, y: 847 },    // 슬롯 5
        { x: 1294, y: 958 },    // 슬롯 6
    ],
    // 건물 위치 (도로 오른쪽) - Base.svg의 회색 박스 위치
    buildings: [
        { x: 721.904, y: 56 },      // 슬롯 0
        { x: 904.888, y: 160.522 }, // 슬롯 1
        { x: 1086.92, y: 267.112 }, // 슬롯 2
        { x: 1284.87, y: 379.945 }, // 슬롯 3
        { x: 1488.55, y: 496.221 }, // 슬롯 4
        { x: 1690.83, y: 610.808 }, // 슬롯 5
        { x: 1896.43, y: 726.209 }, // 슬롯 6
    ],
    // 숫자 위치 (표지판 내부, 표지판 기준 상대 좌표)
    numberOffset: { x: 30, y: 100 }
};

// 건물 타입별 오프셋 (concept.svg에서 계산)
// 회색 박스 좌표에서 실제 건물 배치 좌표로의 오프셋
const BUILDING_OFFSETS = {
    'Xsmall': { x: -72, y: -56 },   // 650 - 721.904 ≈ -72, 0 - 56 = -56
    'Small':  { x: -78, y: -57 },   // 828 - 904.888 ≈ -77, 104 - 160.522 ≈ -57
    'Middle': { x: -69, y: -157 },  // Middle은 더 높으므로 y 오프셋 더 큼
    'Big':    { x: -126, y: -212 }, // Big은 가장 크므로 y 오프셋 가장 큼
};

// 단일 숫자 SVG 생성
function createNumberSVG(count, baseX, baseY) {
    const digit = count.toString();
    let result = '';
    
    if (count < 10) {
        // 한 자리 숫자
        const numSvg = loadSVGContent(`${digit}.svg`);
        if (numSvg) {
            const inner = extractSVGInner(numSvg);
            result += `<g transform="translate(${baseX}, ${baseY})">${inner}</g>\n`;
        }
    } else {
        // 두 자리 숫자 - 왼쪽으로 오프셋해서 중앙 정렬
        const digits = digit.split('');
        const startX = baseX - 9;  // 왼쪽으로 이동하여 중앙 정렬
        const startY = baseY - 5;  // 약간 위로
        
        digits.forEach((d, idx) => {
            const numSvg = loadSVGContent(`${d}.svg`);
            if (numSvg) {
                const inner = extractSVGInner(numSvg);
                // isometric 좌표에서 두 번째 숫자는 오른쪽 아래로
                const offsetX = idx * 18;
                const offsetY = idx * 10;
                result += `<g transform="translate(${startX + offsetX}, ${startY + offsetY})">${inner}</g>\n`;
            }
        });
    }
    
    return result;
}

// 메인 SVG 생성
async function generateContributionCity() {
    console.log('Fetching GitHub contributions...');
    
    const calendar = await fetchContributions();
    let weekData = calendar ? getLastWeekContributions(calendar) : [];
    
    // 테스트 데이터 (API가 없을 경우) - 최근 7일 시뮬레이션
    const today = new Date();
    const testData = [];
    const testCommits = [3, 4, 1, 10, 6, 5, 11]; // 테스트용 커밋 수
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        testData.push({
            contributionCount: testCommits[6 - i],
            date: date.toISOString().split('T')[0],
            weekday: date.getDay()
        });
    }
    
    // API 데이터가 없으면 테스트 데이터 사용
    if (weekData.length !== 7) {
        weekData = testData;
        console.log('Using test data (API unavailable)');
    }
    
    console.log('Last 7 days data:');
    weekData.forEach((d, i) => {
        const dayName = WEEKDAY_NAMES[new Date(d.date).getDay()];
        console.log(`  ${i + 1}. ${d.date} (${dayName}): ${d.contributionCount} commits`);
    });
    
    // Base SVG 로드
    const baseSvg = loadSVGContent('Base.svg');
    if (!baseSvg) {
        console.error('Base.svg not found!');
        return;
    }
    
    // Base SVG의 viewBox와 크기 추출
    const viewBoxMatch = baseSvg.match(/viewBox="([^"]+)"/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 2166 1280';
    
    let svgContent = `<svg width="2166" height="1280" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">\n`;
    
    // Base 추가
    svgContent += extractSVGInner(baseSvg);
    svgContent += '\n';
    
    // 7일치 데이터를 순서대로 배치 (첫번째가 가장 오래된 날, 마지막이 오늘)
    for (let i = 0; i < 7; i++) {
        const dayData = weekData[i];
        const commits = dayData ? dayData.contributionCount : 0;
        const date = new Date(dayData.date);
        const weekday = WEEKDAY_NAMES[date.getDay()];
        
        // 건물 추가 (커밋이 있을 경우에만)
        const buildingType = getBuildingType(commits);
        if (buildingType) {
            const buildingSvg = loadSVGContent(`${buildingType}.svg`);
            if (buildingSvg) {
                const buildingPos = POSITIONS.buildings[i];
                const buildingInner = extractSVGInner(buildingSvg);
                const offset = BUILDING_OFFSETS[buildingType];
                
                svgContent += `<!-- Day ${i + 1} (${weekday}) Building (${buildingType}) - ${commits} commits -->\n`;
                svgContent += `<g transform="translate(${buildingPos.x + offset.x}, ${buildingPos.y + offset.y})">\n`;
                svgContent += buildingInner;
                svgContent += `</g>\n\n`;
            }
        }
        
        // 표지판 추가 (해당 요일의 표지판 SVG 사용)
        const signSvg = loadSVGContent(`${weekday}.svg`);
        if (signSvg) {
            const signPos = POSITIONS.signs[i];
            const signInner = extractSVGInner(signSvg);
            svgContent += `<!-- Day ${i + 1} (${weekday}) Sign -->\n`;
            svgContent += `<g transform="translate(${signPos.x}, ${signPos.y})">\n`;
            svgContent += signInner;
            
            // 숫자 추가
            svgContent += createNumberSVG(commits, POSITIONS.numberOffset.x, POSITIONS.numberOffset.y);
            svgContent += `</g>\n\n`;
        }
    }
    
    svgContent += '</svg>';
    
    // 파일 저장
    const outputPath = path.join(__dirname, 'contribution-city.svg');
    fs.writeFileSync(outputPath, svgContent);
    console.log(`Generated: ${outputPath}`);
    
    return svgContent;
}

// 실행
generateContributionCity().catch(console.error);