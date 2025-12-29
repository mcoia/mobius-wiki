import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { LeftSidebar } from '../left-sidebar/left-sidebar';
import { RightToc } from '../right-toc/right-toc';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Header, LeftSidebar, RightToc],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout {

}
