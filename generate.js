const https = require('https');
const fs = require('fs');

// 환경 변수 설정 (실행 시 필요)
// process.env.GITHUB_TOKEN = '여기에_토큰_입력';
// process.env.USERNAME = '여기에_유저네임_입력';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

if (!GITHUB_TOKEN || !USERNAME) {
    console.error('Error: GITHUB_TOKEN and USERNAME environment variables are required.');
    process.exit(1);
}

// GraphQL 쿼리로 contribution 데이터 가져오기
async function fetchContributions() {
    const query = `
    query($username: String!) {
        user(login: $username) {
            contributionsCollection {
                contributionCalendar {
                    totalContributions
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

    const body = JSON.stringify({
        query,
        variables: { username: USERNAME }
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.github.com',
            path: '/graphql',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'contribution-city-generator'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.errors) {
                        reject(new Error(JSON.stringify(json.errors)));
                    } else {
                        resolve(json.data.user.contributionsCollection.contributionCalendar);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// 최근 데이터 추출 (이미지 레이아웃에 맞춰 6일치만 사용)
function getLastWeekData(calendar) {
    const allDays = calendar.weeks.flatMap(w => w.contributionDays);
    // 마지막 6일 데이터만 추출 (MON~SAT 6개 구조물에 매핑하기 위함)
    return allDays.slice(-6);
}

// SVG 생성 함수
function generateSVG(weekData, totalContributions) {
    const width = 900;
    const height = 500;
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // 등각투영 변환 함수 (조금 더 가파른 각도로 수정)
    const isoX = (x, y) => width / 2 + (x - y);
    const isoY = (x, y, z) => height / 2 + (x + y) * 0.5 - z;

    // 픽셀 스타일 3D 텍스트 그리기 헬퍼 함수
    const drawPixelText = (x, y, z, text, colorTop, colorSide) => {
        const posX = isoX(x, y);
        const posY = isoY(x, y, z);
        // 텍스트를 여러 겹 겹쳐서 3D 픽셀 느낌 구현
        return `
            <g style="font-family: 'Courier New', monospace; font-weight: bold;">
                <text x="${posX + 2}" y="${posY + 2}" text-anchor="middle" fill="#000000" opacity="0.5">${text}</text>
                <text x="${posX + 1}" y="${posY + 1}" text-anchor="middle" fill="${colorSide}">${text}</text>
                <text x="${posX}" y="${posY}" text-anchor="middle" fill="${colorTop}">${text}</text>
            </g>
        `;
    };

    // 픽셀 스타일 구조물(건물/전등) 그리기 헬퍼 함수
    const drawStructure = (type, x, y, width, depth, height, dayData) => {
        let svgContent = '';
        const zBase = 0;
        
        // 픽셀 스타일 색상 팔레트
        const colors = {
            lamp: { top: '#4a4a4a', side: '#333333', front: '#222222', light: '#ffdd66' },
            building: { top: '#6a6a5a', side: '#4a4a3a', front: '#5a5a4a', winOn: '#ffdd66', winOff: '#2a2a22' }
        };
        const c = colors[type === 'lamp' ? 'lamp' : 'building'];
        const strokeStyle = 'stroke="#111111" stroke-width="2" stroke-linejoin="round"';

        // 구조물 본체 그리기 (두꺼운 테두리로 픽셀 느낌 강조)
        const p = {
             f1: { x: isoX(x, y), y: isoY(x, y, zBase) },
             f2: { x: isoX(x + width, y), y: isoY(x + width, y, zBase) },
             f3: { x: isoX(x + width, y + depth), y: isoY(x + width, y + depth, zBase) },
             f4: { x: isoX(x, y + depth), y: isoY(x, y + depth, zBase) },
             t1: { x: isoX(x, y), y: isoY(x, y, height) },
             t2: { x: isoX(x + width, y), y: isoY(x + width, y, height) },
             t3: { x: isoX(x + width, y + depth), y: isoY(x + width, y + depth, height) },
             t4: { x: isoX(x, y + depth), y: isoY(x, y + depth, height) }
        };

        // 뒷면 (가려지지만 입체감을 위해)
        svgContent += `<polygon points="${p.f3.x},${p.f3.y} ${p.t3.x},${p.t3.y} ${p.t4.x},${p.t4.y} ${p.f4.x},${p.f4.y}" fill="${c.side}" ${strokeStyle}/>`;
        svgContent += `<polygon points="${p.f3.x},${p.f3.y} ${p.t3.x},${p.t3.y} ${p.t2.x},${p.t2.y} ${p.f2.x},${p.f2.y}" fill="${c.front}" ${strokeStyle}/>`;
        
        // 앞면, 옆면, 윗면
        svgContent += `<polygon points="${p.f1.x},${p.f1.y} ${p.t1.x},${p.t1.y} ${p.t4.x},${p.t4.y} ${p.f4.x},${p.f4.y}" fill="${c.side}" ${strokeStyle}/>`;
        svgContent += `<polygon points="${p.f1.x},${p.f1.y} ${p.t1.x},${p.t1.y} ${p.t2.x},${p.t2.y} ${p.f2.x},${p.f2.y}" fill="${c.front}" ${strokeStyle}/>`;
        svgContent += `<polygon points="${p.t1.x},${p.t1.y} ${p.t2.x},${p.t2.y} ${p.t3.x},${p.t3.y} ${p.t4.x},${p.t4.y}" fill="${c.top}" ${strokeStyle}/>`;

        // 전등일 경우 불빛 추가
        if (type === 'lamp') {
            const lightH = 15;
            const lightZ = height - 5;
            const lp = {
                t1: { x: isoX(x+2, y+2), y: isoY(x+2, y+2, lightZ + lightH) },
                t2: { x: isoX(x + width-2, y+2), y: isoY(x + width-2, y+2, lightZ + lightH) },
                t3: { x: isoX(x + width-2, y + depth-2), y: isoY(x + width-2, y + depth-2, lightZ + lightH) },
                t4: { x: isoX(x+2, y + depth-2), y: isoY(x+2, y + depth-2, lightZ + lightH) },
                b1: { x: isoX(x+5, y+5), y: isoY(x+5, y+5, lightZ) },
                b2: { x: isoX(x + width-5, y+5), y: isoY(x + width-5, y+5, lightZ) },
                b3: { x: isoX(x + width-5, y + depth-5), y: isoY(x + width-5, y + depth-5, lightZ) },
                b4: { x: isoX(x+5, y + depth-5), y: isoY(x+5, y + depth-5, lightZ) },
            };
            // 불빛 갓
            svgContent += `<polygon points="${lp.t1.x},${lp.t1.y} ${lp.t2.x},${lp.t2.y} ${lp.t3.x},${lp.t3.y} ${lp.t4.x},${lp.t4.y}" fill="${c.top}" ${strokeStyle}/>`;
             // 불빛 나오는 부분 (단순화된 사다리꼴)
            svgContent += `<polygon points="${lp.t2.x},${lp.t2.y} ${lp.b2.x},${lp.b2.y} ${lp.b3.x},${lp.b3.y} ${lp.t3.x},${lp.t3.y}" fill="${c.light}" opacity="0.8" ${strokeStyle}/>`;
            svgContent += `<polygon points="${lp.t1.x},${lp.t1.y} ${lp.b1.x},${lp.b1.y} ${lp.b2.x},${lp.b2.y} ${lp.t2.x},${lp.t2.y}" fill="${c.light}" opacity="0.9" ${strokeStyle}/>`;

            // 바닥에 빛 번짐 효과
            svgContent += `<ellipse cx="${isoX(x + width/2, y + depth/2)}" cy="${isoY(x + width/2, y + depth/2, 0)}" rx="40" ry="20" fill="#ffdd66" opacity="0.2" class="lamp-glow"/>`;
        }

        // 건물의 창문 그리기
        if (type === 'building') {
            const winSize = 8;
            const winGap = 12;
            const rows = Math.floor((height - 10) / winGap);
            const colsFront = Math.floor((width - 5) / winGap);
            const colsSide = Math.floor((depth - 5) / winGap);

            for (let r = 0; r < rows; r++) {
                const winZ = height - 15 - r * winGap;
                // 정면 창문
                for (let c = 0; c < colsFront; c++) {
                    const winX = x + 5 + c * winGap;
                    const winY = y - 1; // 약간 튀어나오게
                    const isLit = Math.random() > 0.3 || dayData.contributionCount > 0; // 기여도 있으면 불 켤 확률 높음
                    const winColor = isLit ? colors.building.winOn : colors.building.winOff;
                    svgContent += `<polygon points="${isoX(winX, winY)},${isoY(winX, winY, winZ)} ${isoX(winX+winSize, winY)},${isoY(winX+winSize, winY, winZ)} ${isoX(winX+winSize, winY)},${isoY(winX+winSize, winY, winZ-winSize)} ${isoX(winX, winY)},${isoY(winX, winY, winZ-winSize)}" fill="${winColor}" ${strokeStyle} class="${isLit?'window':''}"/>`;
                }
                // 측면 창문
                for (let c = 0; c < colsSide; c++) {
                    const winX = x - 1;
                    const winY = y + 5 + c * winGap;
                     const isLit = Math.random() > 0.3 || dayData.contributionCount > 0;
                     const winColor = isLit ? colors.building.winOn : colors.building.winOff;
                    svgContent += `<polygon points="${isoX(winX, winY)},${isoY(winX, winY, winZ)} ${isoX(winX, winY+winSize)},${isoY(winX, winY+winSize, winZ)} ${isoX(winX, winY+winSize)},${isoY(winX, winY+winSize, winZ-winSize)} ${isoX(winX, winY)},${isoY(winX, winY, winZ-winSize)}" fill="${winColor}" ${strokeStyle} class="${isLit?'window':''}"/>`;
                }
            }
        }

        // 라벨 그리기 (요일 및 기여 수)
        const labelZ = height + 25;
        const centerX = x + width / 2;
        const centerY = y + depth / 2;
        const dayName = dayNames[dayData.weekday];
        const count = dayData.contributionCount;

        // 요일 (파란색 계열 3D 텍스트)
        svgContent += drawPixelText(centerX, centerY, labelZ, dayName, '#4a90e2', '#357abd');
        // 기여 수 (노란색 계열 3D 텍스트)
        svgContent += drawPixelText(centerX, centerY, labelZ - 15, count, '#ffdd66', '#e6c35c');

        return svgContent;
    };


    // --- 메인 그리기 로직 ---
    let content = '';

    // 1. 배경 요소 (하늘, 별, 달)
    let stars = '';
    for (let i = 0; i < 50; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height / 2;
        const r = Math.random() * 1.5 + 0.5;
        const delay = (Math.random() * 3).toFixed(1);
        stars += `<rect x="${sx}" y="${sy}" width="${r}" height="${r}" fill="white" class="star" style="animation-delay: ${delay}s"/>`;
    }

    // 2. 지형 (왼쪽 잔디, 오른쪽 도로)
    // 잔디 영역 (왼쪽)
    const grass = `<polygon points="${isoX(-200, -200)},${isoY(-200, -200, 0)} ${isoX(100, -200)},${isoY(100, -200, 0)} ${isoX(100, 300)},${isoY(100, 300, 0)} ${isoX(-200, 300)},${isoY(-200, 300, 0)}" fill="#2a4a2a" stroke="#1a3a1a" stroke-width="2"/>`;
    // 잔디 질감 (픽셀 점)
    let grassTexture = '';
    for(let i=0; i<200; i++) {
        const gx = Math.random() * 300 - 200;
        const gy = Math.random() * 500 - 200;
         grassTexture += `<rect x="${isoX(gx, gy)}" y="${isoY(gx, gy, 0)}" width="2" height="2" fill="#3a5a3a"/>`;
    }

    // 도로 영역 (오른쪽)
    const road = `<polygon points="${isoX(100, -220)},${isoY(100, -220, 0)} ${isoX(350, -220)},${isoY(350, -220, 0)} ${isoX(350, 320)},${isoY(350, 320, 0)} ${isoX(100, 320)},${isoY(100, 320, 0)}" fill="#2a2a2a" stroke="#1a1a1a" stroke-width="2"/>`;
    // 도로 중앙선
    const roadLine = `<line x1="${isoX(225, -220)}" y1="${isoY(225, -220, 0)}" x2="${isoX(225, 320)}" y2="${isoY(225, 320, 0)}" stroke="#555555" stroke-width="4" stroke-dasharray="15,15"/>`;


    // 3. 구조물 배치 (요청하신 고정 순서)
    const structureLayout = [
        { type: 'lamp',     scale: 'small' },  // 1. 전등 (작게, 디테일 줄임)
        { type: 'building', scale: 'medium' }, // 2. 중간 건물
        { type: 'building', scale: 'small' },  // 3. 작은 건물
        { type: 'building', scale: 'large' },  // 4. 큰 건물
        { type: 'building', scale: 'small' },  // 5. 작은 건물
        { type: 'building', scale: 'large' }   // 6. 큰 건물
    ];
    
    const sizes = {
        smallLamp: { w: 10, d: 10, h: 60 },
        small: { w: 30, d: 30, h: 60 },
        medium: { w: 35, d: 35, h: 100 },
        large: { w: 40, d: 40, h: 150 }
    };

    let structuresSvg = '';
    let currentY = -150; // 시작 위치 Y 좌표
    const spacingY = 65; // 구조물 간 간격

    // 데이터와 레이아웃 매핑하여 그리기
    structureLayout.forEach((layout, index) => {
        if (index >= weekData.length) return; // 데이터가 부족하면 스킵
        const data = weekData[index];
        const size = sizes[layout.scale + (layout.type === 'lamp' ? 'Lamp' : '')];
        // 도로 오른쪽에 배치하기 위한 X 좌표 고정
        const fixedX = 250; 
        
        structuresSvg += drawStructure(layout.type, fixedX, currentY, size.w, size.d, size.h, data);
        currentY += spacingY;
    });


    // 4. 자동차 (픽셀 스타일)
    const drawPixelCar = (x, y, colorBody, colorTop) => {
        const z = 0;
        const w = 30, d = 50, hBody = 12, hTop = 10;
        const stroke = 'stroke="#111111" stroke-width="2" stroke-linejoin="round"';
        
        let carSvg = `<g class="car">`;
        // 차체 하단
        carSvg += `<polygon points="${isoX(x,y+d)},${isoY(x,y+d,z)} ${isoX(x+w,y+d)},${isoY(x+w,y+d,z)} ${isoX(x+w,y+d)},${isoY(x+w,y+d,z+hBody)} ${isoX(x,y+d)},${isoY(x,y+d,z+hBody)}" fill="${colorBody}" ${stroke}/>`; // 뒤
        carSvg += `<polygon points="${isoX(x,y)},${isoY(x,y,z)} ${isoX(x,y+d)},${isoY(x,y+d,z)} ${isoX(x,y+d)},${isoY(x,y+d,z+hBody)} ${isoX(x,y,z+hBody)},${isoY(x,y,z+hBody)}" fill="${colorBody}" ${stroke}/>`; // 옆
        carSvg += `<polygon points="${isoX(x,y)},${isoY(x,y,z+hBody)} ${isoX(x+w,y)},${isoY(x+w,y,z+hBody)} ${isoX(x+w,y+d)},${isoY(x+w,y+d,z+hBody)} ${isoX(x,y+d)},${isoY(x,y+d,z+hBody)}" fill="${colorBody}" ${stroke}/>`; // 위
        
        // 차체 상단 (지붕)
        const topX = x+2, topY = y+10, topW = w-4, topD = d-25;
        carSvg += `<polygon points="${isoX(topX,topY+topD)},${isoY(topX,topY+topD,z+hBody)} ${isoX(topX+topW,topY+topD)},${isoY(topX+topW,topY+topD,z+hBody)} ${isoX(topX+topW,topY+topD)},${isoY(topX+topW,topY+topD,z+hBody+hTop)} ${isoX(topX,topY+topD)},${isoY(topX,topY+topD,z+hBody+hTop)}" fill="${colorTop}" ${stroke}/>`; // 뒤
         carSvg += `<polygon points="${isoX(topX,topY)},${isoY(topX,topY,z+hBody)} ${isoX(topX,topY+topD)},${isoY(topX,topY+topD,z+hBody)} ${isoX(topX,topY+topD)},${isoY(topX,topY+topD,z+hBody+hTop)} ${isoX(topX,topY,z+hBody+hTop)},${isoY(topX,topY,z+hBody+hTop)}" fill="${colorTop}" ${stroke}/>`; // 옆
        carSvg += `<polygon points="${isoX(topX,topY)},${isoY(topX,topY,z+hBody+hTop)} ${isoX(topX+topW,topY)},${isoY(topX+topW,topY,z+hBody+hTop)} ${isoX(topX+topW,topY+topD)},${isoY(topX+topW,topY+topD,z+hBody+hTop)} ${isoX(topX,topY+topD)},${isoY(topX,topY+topD,z+hBody+hTop)}" fill="${colorTop}" ${stroke}/>`; // 위

        // 헤드라이트 불빛
        carSvg += `<polygon points="${isoX(x+w-5, y)},${isoY(x+w-5, y, z+5)} ${isoX(x+w+50, y-150)},${isoY(x+w+50, y-150, z)} ${isoX(x-50, y-150)},${isoY(x-50, y-150, z)} ${isoX(x+5, y)},${isoY(x+5, y, z+5)}" fill="#ffdd66" opacity="0.2" />`;
        carSvg += `</g>`;
        return carSvg;
    };

    const cars = drawPixelCar(150, 0, '#357abd', '#4a90e2') + drawPixelCar(180, 120, '#357abd', '#4a90e2');


    // SVG 조합
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <defs>
        <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#0a0a15"/>
            <stop offset="100%" style="stop-color:#1a1a2a"/>
        </linearGradient>
        <style>
            @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
            @keyframes flicker { 0%, 90%, 100% { opacity: 1; } 95% { opacity: 0.7; } }
            @keyframes lampPulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.25; } }
            .star { animation: twinkle 3s infinite; }
            .window { animation: flicker 6s infinite alternate; }
            .lamp-glow { animation: lampPulse 4s infinite; }
        </style>
    </defs>
    
    <rect width="${width}" height="${height}" fill="url(#skyGradient)"/>
    ${stars}
    <g transform="translate(750, 80)">
        <circle cx="0" cy="0" r="40" fill="#ffffee" stroke="#ddddcc" stroke-width="3"/>
        <circle cx="-15" cy="-10" r="8" fill="#ddddcc" opacity="0.5"/>
        <circle cx="10" cy="5" r="12" fill="#ddddcc" opacity="0.5"/>
        <circle cx="20" cy="-15" r="5" fill="#ddddcc" opacity="0.5"/>
    </g>

    ${grass}
    ${grassTexture}
    ${road}
    ${roadLine}

    ${cars}
    ${structuresSvg}

    <g style="font-family: 'Courier New', monospace; font-weight: bold;">
        <text x="${width/2}" y="50" text-anchor="middle" fill="#ffffff" font-size="32" stroke="#000000" stroke-width="2" paint-order="stroke">Contribution City</text>
        <text x="30" y="${height - 60}" fill="#ffffff" font-size="20" stroke="#000000" stroke-width="1.5" paint-order="stroke">TOTAL: <tspan fill="#ffdd66">${totalContributions}</tspan></text>
        <text x="30" y="${height - 30}" fill="#ffffff" font-size="20" stroke="#000000" stroke-width="1.5" paint-order="stroke">TODAY: <tspan fill="#ffdd66">${weekData[weekData.length-1].contributionCount}</tspan></text>
    </g>
</svg>`;

    return svg;
}

// 메인 실행
async function main() {
    try {
        console.log(`Fetching contributions for ${USERNAME}...`);
        const calendar = await fetchContributions();
        
        console.log(`Total contributions: ${calendar.totalContributions}`);
        
        const weekData = getLastWeekData(calendar);
        console.log('Last 6 days data:', weekData.map(d => `${d.date} (${d.weekday}): ${d.contributionCount}`).join(', '));
        
        const svg = generateSVG(weekData, calendar.totalContributions);
        
        const outputDir = 'profile-3d-contrib';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        
        fs.writeFileSync(`${outputDir}/contribution-city.svg`, svg);
        console.log(`Generated: ${outputDir}/contribution-city.svg`);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();