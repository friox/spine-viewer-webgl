import { processSpineFiles } from "@/lib/spine/spineService";
import { useSpineStore } from "@/stores/useSpineStore";
import {
  RiArrowDownWideLine,
  RiArrowUpWideLine,
  RiAttachmentLine,
  RiComputerLine,
  RiMovie2Line,
  RiResetRightFill,
  RiSearchLine,
  RiStackLine,
  RiVideoOnLine,
} from "@remixicon/react";
import { useRef, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "./ui/combobox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import { Item, ItemActions, ItemContent, ItemTitle } from "./ui/item";
import { ScrollArea } from "./ui/scroll-area";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";

export function SpineControlPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const {
    loadedSpineFiles,
    zoom,
    showGuideline,
    isPlaying,
    timeScale,
    animations,
    skins,
    currentAnimation,
    currentSkin,
    slots,
    activeSkinOnlySlots,
    premultipliedAlpha,
    showDebugBounds,
    setZoom,
    setShowGuideline,
    setIsPlaying,
    setTimeScale,
    setAnimation,
    setSkin,
    setSlotVisibility,
    setActiveSkinOnlySlots,
    setPremultipliedAlpha,
    setShowDebugBounds,
    setAllSlotsVisibility,
    exportPng,
  } = useSpineStore();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const selectedFiles: File[] = Array.from(fileList);
    processSpineFiles(selectedFiles);
    e.target.value = "";
  };
  const filteredSlots = slots.filter((slot) => slot.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const hiddenCount = slots.filter((slot) => !slot.visible).length;
  const [expanded, setExpanded] = useState({
    data: true,
    playback: false,
    character: false,
    slots: false,
    display: true,
  });
  const toggle = (key: keyof typeof expanded) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  return (
    <div className="select-none">
      <div className="flex flex-col gap-1 p-5">
        <p className="text-xl font-bold">Spine Viewer WebGL</p>
        <a className="text-sm text-muted-foreground w-fit font-mono uppercase" href="https://github.com/friox/spine-viewer-webgl" target="_blank" rel="norefferer" title="github">#{__COMMIT_HASH__}</a>
      </div>
      <hr />
      <div className="flex flex-col gap-5 p-5">
        {/* 데이터 */}
        <Card>
          <CardHeader className="cursor-pointer gap-0" onClick={() => toggle("data")}>
            <CardTitle className="flex items-center gap-2">
              <RiAttachmentLine />
              데이터
            </CardTitle>
            <CardAction>{expanded.data ? <RiArrowUpWideLine /> : <RiArrowDownWideLine />}</CardAction>
          </CardHeader>
          {expanded.data && (
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Button onClick={() => fileInputRef.current?.click()} className="w-full">스파인 데이터 선택</Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".skel,.json,.atlas,.png,.txt,.bytes"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button onClick={() => exportPng()} className="w-full">PNG로 내보내기</Button>
                </div>
                <div className="flex flex-col gap-1 justify-start">
                  <p className="font-mono">
                    skel : <span>{loadedSpineFiles?.skelFile?.name}</span>
                  </p>
                  <p className="font-mono">
                    atlas : <span>{loadedSpineFiles?.atlasFile?.name}</span>
                  </p>
                  <p className="font-mono">
                    png :{" "}
                    <span>
                      {loadedSpineFiles?.pngFiles.length
                        ? loadedSpineFiles.pngFiles.length > 1
                          ? `${loadedSpineFiles.pngFiles.length} files`
                          : loadedSpineFiles.pngFiles[0].name
                        : ""}
                    </span>
                  </p>
                  <p className="font-mono">
                    version : <span>{loadedSpineFiles?.version}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 재생 제어 */}
        <Card>
          <CardHeader className="cursor-pointer gap-0" onClick={() => toggle("playback")}>
            <CardTitle className="flex items-center gap-2">
              <RiVideoOnLine />
              재생 제어
            </CardTitle>
            <CardAction>{expanded.playback ? <RiArrowUpWideLine /> : <RiArrowDownWideLine />}</CardAction>
          </CardHeader>
          {expanded.playback && (
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <p>재생 속도</p>
                    <p className="font-mono">x{timeScale.toFixed(1)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[timeScale]}
                      min={0.1}
                      max={2.0}
                      step={0.1}
                      onValueChange={(val) => setTimeScale(val as number)}
                    />
                    <Button size="xs" onClick={() => setTimeScale(1.0)}>
                      <RiResetRightFill />
                      초기화
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => setIsPlaying(true)} disabled={isPlaying}>
                    재생
                  </Button>
                  <Button className="flex-1" onClick={() => setIsPlaying(false)} disabled={!isPlaying}>
                    일시정지
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 캐릭터 설정 */}
        <Card>
          <CardHeader className="cursor-pointer gap-0" onClick={() => toggle("character")}>
            <CardTitle className="flex items-center gap-2">
              <RiMovie2Line />
              캐릭터 설정
            </CardTitle>
            <CardAction>{expanded.character ? <RiArrowUpWideLine /> : <RiArrowDownWideLine />}</CardAction>
          </CardHeader>
          {expanded.character && (
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p>스킨</p>
                  <Combobox items={skins} value={currentSkin || ""} onValueChange={(val) => val && setSkin(val)}>
                    <ComboboxInput placeholder="스킨 선택" />
                    <ComboboxContent>
                      <ComboboxEmpty>스킨이 없습니다.</ComboboxEmpty>
                      <ComboboxList>
                        {(item) => (
                          <ComboboxItem key={item} value={item}>
                            {item}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
                <div className="flex flex-col gap-1">
                  <p>애니메이션</p>
                  <Combobox
                    items={animations}
                    value={currentAnimation || ""}
                    onValueChange={(val) => val && setAnimation(val)}>
                    <ComboboxInput placeholder="애니메이션 선택" />
                    <ComboboxContent>
                      <ComboboxEmpty>애니메이션이 없습니다.</ComboboxEmpty>
                      <ComboboxList>
                        {(item) => (
                          <ComboboxItem key={item} value={item}>
                            {item}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 슬롯 제어 */}
        <Card>
          <CardHeader className="cursor-pointer gap-0" onClick={() => toggle("slots")}>
            <CardTitle className="flex items-center gap-2">
              <RiStackLine />
              파츠(슬롯) 제어
              {hiddenCount > 0 && <Badge variant="destructive">{hiddenCount}개 숨겨짐</Badge>}
            </CardTitle>
            <CardAction>{expanded.slots ? <RiArrowUpWideLine /> : <RiArrowDownWideLine />}</CardAction>
          </CardHeader>
          {expanded.slots && (
            <CardContent>
              <div className="flex flex-col gap-3">
                <InputGroup>
                  <InputGroupInput
                    placeholder="파츠 이름으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <InputGroupAddon>
                    <RiSearchLine />
                  </InputGroupAddon>
                  <InputGroupAddon align="inline-end">{filteredSlots.length}개</InputGroupAddon>
                </InputGroup>
                <Item variant="outline" className="bg-input/30 border-input">
                  <ItemContent>
                    <ItemTitle>사용 중인 파츠만 목록에 표시</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <Switch
                      checked={activeSkinOnlySlots}
                      onCheckedChange={(checked) => setActiveSkinOnlySlots(checked)}
                    />
                  </ItemActions>
                </Item>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() =>
                      setAllSlotsVisibility(
                        true,
                        filteredSlots.map((s) => s.name)
                      )
                    }>
                    모두 표시
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() =>
                      setAllSlotsVisibility(
                        false,
                        filteredSlots.map((s) => s.name)
                      )
                    }>
                    모두 숨김
                  </Button>
                </div>
                <ScrollArea className="h-50 border border-input">
                  <div className="flex flex-col gap-2 m-3">
                    {filteredSlots.map((slot) => (
                      <div
                        key={slot.name}
                        onClick={() => setSlotVisibility(slot.name, !slot.visible)}
                        className={`flex flex-col border border-input py-2 px-3 gap-1 cursor-pointer transition-opacity ${slot.visible ? "bg-input/30 opacity-100" : "bg-input/10 opacity-40"}`}>
                        <p className="leading-none">{slot.name}</p>
                        <p className="leading-none text-muted-foreground">{slot.attachmentName || "-"}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          )}
        </Card>

        {/* 화면 설정 */}
        <Card>
          <CardHeader className="cursor-pointer gap-0" onClick={() => toggle("display")}>
            <CardTitle className="flex items-center gap-2">
              <RiComputerLine />
              화면 설정
            </CardTitle>
            <CardAction>{expanded.display ? <RiArrowUpWideLine /> : <RiArrowDownWideLine />}</CardAction>
          </CardHeader>
          {expanded.display && (
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <p>확대 배율</p>
                    <p className="font-mono">{Math.round(zoom * 100)} %</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[Math.round(zoom * 100)]}
                      min={10}
                      max={500}
                      step={10}
                      onValueChange={(val) => setZoom((val as number) / 100)}
                    />
                    <Button size="xs" onClick={() => setZoom(1.0)}>
                      <RiResetRightFill />
                      초기화
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Item variant="outline" className="bg-input/30 border-input">
                    <ItemContent>
                      <ItemTitle>원점 가이드 표시</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Switch checked={showGuideline} onCheckedChange={(checked) => setShowGuideline(checked)} />
                    </ItemActions>
                  </Item>
                  <Item variant="outline" className="bg-input/30 border-input">
                    <ItemContent>
                      <ItemTitle>PMA 렌더링</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Switch
                        checked={premultipliedAlpha}
                        onCheckedChange={(checked) => setPremultipliedAlpha(checked)}
                      />
                    </ItemActions>
                  </Item>
                  <Item variant="outline" className="bg-input/30 border-input">
                    <ItemContent>
                      <ItemTitle>바운딩 박스 표시</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Switch checked={showDebugBounds} onCheckedChange={(checked) => setShowDebugBounds(checked)} />
                    </ItemActions>
                  </Item>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
