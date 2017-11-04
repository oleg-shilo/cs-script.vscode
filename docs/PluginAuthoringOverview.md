# Authoring plugins for VSCode, Sublime and Notepad++

__Preamble__

I am in a reasonably unique position as I have developed a complex plugin (and a few simpler ones) that has been ported to all three peoples editors: Notepad++, Sublime Text and VSCode.

The presented content is a reflection of my personal experiences and it should be taken as such. Many people may disagree with my conclusions and I actually expect that as it wasn't my goal to provide a final undisputed assessment of these wonderful platform. 

My objective was to give the developers an idea about what to expect when they are about to start developing for the nominated editors. And also to give the opportunity for the editor's maintainers to understand the shortcomings of the developer experience they provide an possible address them.   

__Notepad++ (N++)__

*Audience*

Enormous. Anyone from a beginner to an advanced programmer. 
N++ was the best vehicle to promote CS-Script. Currently the overall raw downloads count for the plugin is over 1,000,000.

*User experience*

It's really great. Huge library of plugins. Variety of the plugins is very impressive. It covers both UI and non-UI plugins. Down side - available only on Windows.

This is the look and feel of the CS-Script plugin for N++. It achieves very VS-like appearance and experience:

![](https://github.com/oleg-shilo/cs-script.npp/raw/master/wiki/debugger.png)

*Developer experience*

Sadly, my least favorite out of all three platforms.

The hosting model is rather average in terms of the design quality. They failed to recognize the importance of a platform neutral runtime for hosting plugins and opted to the native runtime. Meaning C/C++. Even if one uses a bridge to .NET or Python, the plugin for x64 needs to be maintained completely separately (separate builds and binary repositories). 

Think about it, ST3 and VSCode plugins work on all OSs but for N++ (that works only on Windows) you need to maintain two separate plugins (x86 vs x64).

API itself leaves so much to be desired. It is very limited and extremely old fashioned. N++ only offers a very lean own API and simply tunnels the developer to the old Scintilla rendering engine API. And Scintilla is the beast of an old school. I pretends it is still 2000. Sometimes it even forces you to deal with text as a array of bytes not characters (selection length is an amount of selected bytes). 

Scintilla does an excellent rendering job but that's it. It's hard to be impressed by its other functionality. Tooltips are not interactive. Styling for tooltips and auto-completion is not possible. On a bright side N++ lets you to hook up into its own windows management so you can create custom panels/view. Meaning that by going _low-level_ you can achieve virtually any appearance you want (e.g. tree view, lists, host web browser).

*Plugin management*

Plugin management is puzzling. They have implemented very nice Plugin Manager but the public repositories are updated so infrequently that if one has made a mistake in his plugin he will need to wait ~3-4 month before his fix can reach the users. 

_Support and community_

Documentation is rather minimalistic. Dedicated discussion boards are not very sound nor helpful. 

N++ support is shocking. The guys probably work very hard and don't have much time nor opportunity for interacting with the plugin developers. Once, a specific N++ update has delivered a nasty bug that completely broke all plugins that are more complicated then a single dll and rely on their own file/folder structure. One day everything works, next day it starts reporting multiple plugins as "Incompatible with N++". 

The problem  was logged with clear indication of its devastating severity. No response for weeks. I had to chase (unsuccessfully) the team coordinator on his Tweeter and other public platforms. No luck. Only when my plugin users and other plugin authors started complaining on N++ forum the problem was acknowledged and... reluctantly fixed.

The only positive dev experience is that one can use the debugger. Another one is that being native means that virtually any functionality can be achieved.

*Bottom line*

Light, dynamic and extremely customizable. Targeting, arguably, a slightly more advanced audience. Delivers almost flawless user experience while imposing certain limitations on the plugin developers.

The platform is slightly friendlier towards development of the simpler/smaller plugins. While the complex comprehensive plugins are definitely possible but at the higher effort cost.​

__Sublime Text 3 (ST3)__

*Audience*

Sublime is an extremely popular editor. It has an reputation of a sophisticated programming tool that can be truly appreciated by professionals. I tend to agree. The beginners may find it being overloaded with customization but seasoned developers just love every bit of it.

*User experience*

One word comes in mind - slick. It's brilliant. Lightning fast. Fastest to startup out of all three. The level of customization is out of this world.

Sometimes the customization may even conflict with the convenience. Thus using, very frequently, column selection in VS, VSCode and N++ I found its implementation on ST3 (via mutli-cursor mode) to be a bit "stubborn". 

There is a huge library of plugins. Available on all OSs.

Though, one obvious negative is the absence of printing support out of box. For such a comprehensive editor not to have such a fundamental feature seems rather puzzling, to say the least. One needs to install one of the few printing plugins in order to enable printing (usually via system web browser). 

*Developer experience*

Very good. The hosting model is designed brilliantly. Hosting runtime and language is Python. 

API itself is scrupulously designed. Everything just makes sense. Simple, logical and predictable. I one word - elegant. When you don't have something supported naively you can fallback on IDE commands execution. Tooltips are rendered with a light weight HTML engine. Brilliant. You can put there buttons and have complex styling. Great. 

The API's draw back - it's sealed. The API practically has stopped its evolution sealing the state of the functionality as is. 

For example closing already opened file with API is not possible. One has to set focus on the required document tab and execute command "close" (equivalent of Menu->File->Close). Meaning that you have to mess up with the focus. Meaning bad user experience. For more complicated scenarios focus management becomes a real issue. Scanning keyboard state is also unavailable. 

Another upsetting design decision is prohibiting completely any custom panels. That's it, ST3 for years resisted developers demands for this feature. You cannot create a custom panel. The best you can do is to open a document, place some special text to mimic rich UI elements (e.g. tree view). I had to go this way with "Favorites" and with "CodeMap" plugins:

![](https://github.com/oleg-shilo/sublime-codemap/raw/master/images/image1.gif)


_Support and community_

Just excellent. The best out of tree. If you post the question the chances are that it will be answered by the people who knows exactly what they are talking about. In general, professional level of an average member of the ST3 community is very high. Occasionally, you can sense religious notes, but very mild. One thing is for sure, if there is the answer and you just don't know where it is the ST3 forum is the place to find it. 
Documentation is simply structured and gives you a very good overview of the overall functionality and possibilities. For everything else - discussion boards.

*Plugin management*

The plugin management is ingenious. The editor can fetch plugins form your local files, your personal GitHub repository or via official GiHub based repository router Plugin Manager. The plugin developer is in full control of the life cycle of his/her plugin.

The biggest downside (apart from stagnating API) is the absence of the integrated debugger. If your plugin exhibits a complex behavior then you are out of luck, you can only rely on Python's "_print()_". This also has indirect drawback: no language-plugins can have a proper debugger runtime integration under ST3. 

Another negative is side-by-side plugin development. One cannot have a plugin installed and being developed/troubleshooted at the same time. Well, it's possible only for the uncompressed plugins, which are officially discouraged. 

And I cannot ignore another unexpected inconvenience. ST3 plugin guideline requires you to distribute the packages in the compressed form. While it has certain benefits for the ST3 dev team it is a nightmare for the plugin developers to troubleshoot such plugins. The only exception is made to the plugins that contain executables, which need to be present in the unpacked form at runtime. 

Thus when I tried to publish my CodeMap plugin in uncompressed form I was approached by the ST3 team member and asked politely to obey the rules and compressed the plugin. I am sure if I start a long boring argument they would let me do it my way but... I would rather prefer to have a choice instead of having to justify my motives. Though this point can be easily challenged by the ST3 team.      

*Bottom line*

Light, dynamic and extremely customizable. Targeting, arguably, a slightly more advanced audience. Delivers almost flawless user experience while imposing certain limitations on the plugin developers. 

The platform is slightly friendlier towards development of the simpler/smaller plugins. While the complex comprehensive plugins are definitely possible but at the higher effort cost.   

__Visual Studio Code (VSCode)__

*Audience*

VSCode shares many similarities with ST3. Including having a very large army of very devoted followers. Due to the superior extension hosting model the **variety** of the extensions is arguably higher then for any other editor. This largely contributes to the constantly growing popularity of the editor    


*User experience*

Well, that's it, this is the strongest VSCode selling point.

The text rendering engine is practically the same as in Atom. VECode uses Electron (Atom fork). Thus when it comes to the text editing experience it is roughly the same as in Atom. But that extra, which VSCode offers is what makes it so different.

For starters, it brings a full scale built-in debugger. Yes, it's not as complete as the one that comes Visual Studio. But make no mistake, it is a true debugger. This is the feature that neither ST3 nor N++ considered to be effort worthy to have. The debugger infrastructure is open and is a part of the extension hosting solution. Meaning that other languages can integrate their debuggers making the editor into a complete IDE.    

Extensions are allowed to bring their own custom views. This opens the doors for the true GUI presentations of any information in the TreeView style:
![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/cs-s_intellisense.gif)


Extensions also can have their frequently used functionality to be accessed via custom toolbar buttons. Excellent.

I deliberately described in this section the functionality that is not available in ST3, the closest competitor of VSCode. None of this is possible in ST3. ST3's team is carefully guarding their product from letting any of these goodnesses to get in. The reasoning is, as for any other over-restrictive frameworks, "These features are not really needed. ST3 is already perfect without them".

Another strong point is a built-in HTML rendered, which makes it possible to achieve some very rich content presentations. It can be just as simple as a markdown content preview or as comprehensive as diagraming with Mermaid.

![](https://github.com/oleg-shilo/cs-script.vscode/raw/master/images/vscode_diagramming.png)

Though there is one strong point of criticism that is brought by practically everyone from the ST3 camp: VSCode is slow to start. Really slow. In my opinion, if it wasn't for slow startup VSCode would be a clear winner in this game.  

*Developer experience*

For developers who just moved to VSCode from other environments it may feel like a breath of fresh air. Availability of the debugger makes the world of difference. Yes it's not only users who benefit from the debugger but the extension developers as well. API itself is intense and makes all the features described in the User Experience section (above) possible.

On negative side, API is not complete. There are certain gaps. For example at this very moment one can create a custom view with the TreeView content but cannot control the tooltip of the tree node. 

Another unpleasant moment is volatility of API. Some parts of API are getting deprecated and replaced with presumably better alternatives. But on practical level it means that your extension can be effectively crippled with the next VSCode update if you are not monitoring the API changes constantly.     

_Support and community_

The VSCode documentation is something that can really take some improvement. It is OK, but just OK. I my opinion it take a wrong approach, serves the wrong use-case. 

With ST3 documentation it's easy to find what methods you need to use even if you only have an idea about what you want to achieve. Whereas with VSCode documentation it's only easy if you want to find out the details of the method when you have the method name name. 

Another slightly unfriendly moment is the troubleshooting advise on VSCode GitHub. They ask you not to post questions there but use _Stack Overflow_ instead. I found it slightly irritating. Stack Overflow is practically useless (at least at this stage) for getting the assistance regarding extensions authoring. It only has some content about using VSCode but not developing for it. Though after weeks of having my questions unanswered on _Stack Overflow_ I actually found some help on VSCode _GitHub_. 

I hope that these minor annoyances are just the side effects of the growth. 


*Plugin management*

The VSCode plugin management is based on the MS market place infrastructure. Thus when the developer is happy with the plugin he can package it and publish on the VSCode plugin gallery. 

The plugin management model is not as flexible as for ST3 but still adequate. Thus while plugin management has no GitHub (or any other SC) integration it lets installing local packages (just a package file), which is an excellent test technique for verifying the health of the package before publishing.

Another positive side of VSCode comparing to ST3 plugin management is that developers are not forced to compress their plugins into the "black-box" zip container. Thus troubleshooting is is much simpler.

*Bottom line*

Vibrant, constantly evolving and ultimately exciting platform. VSCode is almost completely matching all the strongest features of the other popular editors. It also demonstrates good understanding of the developers needs. You will never feel patronized. 

As I see it, it is the most promising platform available today.

If only those just a few limitations/issues are addressed, that would make VSCode a hands down leader in this race.


__Conclusion__

All tree platforms have very solid presence on Desktop and devoted community. And yet all these platforms are quite different. All of them have their positives and negatives and none of them is ideal. Today the major competition is happening between VSCode and ST3. They are the leaders in this race. 

If I use smartphone analogy, this is how I would describe these tree remarkable editors:  

_N++ is as WinPhone_<br>
Once ground breaking. Still relevant, very solid product, which will never be a game changer again. It's just an old dog with the expected attitude to the new tricks.

_ST3 is as iPhone_<br> 
Polished, sexy and still ultimately appealing but... practically no longer evolving. It's just enjoying the past well deserved reputation. The next "big move" is the ~~removal of the headphone jack~~ change of the default color theme. It always carefully prevents you from being too ambitious. 

_VSCode is as Android_<br>
Rough on edges, but dynamic and ambitious. Doesn't always keep its stuff together but respects user's freedom. Have an enormous potential and exhibits remarkable attitude. 

